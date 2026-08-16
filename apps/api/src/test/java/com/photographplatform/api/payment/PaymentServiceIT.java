package com.photographplatform.api.payment;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.invoice.domain.TaxCategory;
import com.photographplatform.api.invoice.dto.CreateInvoiceLineItemRequest;
import com.photographplatform.api.invoice.dto.CreateInvoiceRequest;
import com.photographplatform.api.invoice.dto.InvoiceResponse;
import com.photographplatform.api.invoice.service.InvoiceService;
import com.photographplatform.api.payment.domain.PaymentMethod;
import com.photographplatform.api.payment.dto.CreatePaymentIntentRequest;
import com.photographplatform.api.payment.dto.InvoicePaymentSummaryResponse;
import com.photographplatform.api.payment.dto.PaymentResponse;
import com.photographplatform.api.payment.dto.RecordManualPaymentRequest;
import com.photographplatform.api.payment.service.PaymentService;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.domain.TaxMode;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * F6 payment domain against a real Postgres container. Card/SEPA creation
 * against live Stripe isn't exercised here — that needs a real test-mode
 * secret key (STRIPE_SECRET_KEY) this environment doesn't have — but the
 * webhook signature verification, idempotency, and manual Überweisung path
 * need no live Stripe account and are fully covered.
 */
class PaymentServiceIT extends IntegrationTestBase {

    private static final String WEBHOOK_SECRET = "whsec_test_secret_for_it_only";

    @Autowired private PaymentService paymentService;
    @Autowired private InvoiceService invoiceService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private BookingRepository bookingRepository;

    @MockitoBean
    private R2StorageService r2StorageService;

    @DynamicPropertySource
    static void stripeProperties(DynamicPropertyRegistry registry) {
        // Only the webhook secret — app.stripe.secret-key stays unset so the
        // StripeClient bean stays absent, exactly like a real deployment
        // that hasn't configured card/SEPA yet.
        registry.add("app.stripe.webhook-secret", () -> WEBHOOK_SECRET);
    }

    @Test
    void cardPaymentIsRejectedWhenStripeNotConfigured() {
        TestFixture fx = createTenantAndInvoice();
        assertThatThrownBy(() -> asUser(fx, () -> paymentService.createStripePaymentIntent(
            fx.invoiceId(), new CreatePaymentIntentRequest(PaymentMethod.CARD), "203.0.113.5")))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Stripe");
    }

    @Test
    void manualPaymentDefaultsToOutstandingBalanceAndMarksSucceeded() {
        TestFixture fx = createTenantAndInvoice();

        PaymentResponse payment = asUser(fx, () -> paymentService.recordManualPayment(
            fx.invoiceId(), new RecordManualPaymentRequest(null), "203.0.113.5"));

        assertThat(payment.method()).isEqualTo("UEBERWEISUNG");
        assertThat(payment.status()).isEqualTo("SUCCEEDED");
        assertThat(payment.amountCents()).isEqualTo(fx.totalCents());
        assertThat(payment.confirmedAt()).isNotNull();

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.paidCents()).isEqualTo(fx.totalCents());
        assertThat(summary.outstandingCents()).isZero();
        assertThat(summary.verwendungszweck()).startsWith("RE-");
    }

    @Test
    void partialManualPaymentLeavesOutstandingBalance() {
        TestFixture fx = createTenantAndInvoice();
        int deposit = fx.totalCents() / 2;

        asUser(fx, () -> paymentService.recordManualPayment(
            fx.invoiceId(), new RecordManualPaymentRequest(deposit), "203.0.113.5"));

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.paidCents()).isEqualTo(deposit);
        assertThat(summary.outstandingCents()).isEqualTo(fx.totalCents() - deposit);
    }

    @Test
    void zeroOrNegativeManualPaymentIsRejected() {
        TestFixture fx = createTenantAndInvoice();
        assertThatThrownBy(() -> asUser(fx, () -> paymentService.recordManualPayment(
            fx.invoiceId(), new RecordManualPaymentRequest(0), "203.0.113.5")))
            .isInstanceOf(ConflictException.class);
    }

    @Test
    void manualPaymentAboveTheOutstandingBalanceIsRejected() {
        // Regression: an explicit amountCents was accepted unchecked, so a
        // typo ("100000" for "10000") booked revenue the invoice never asked
        // for — money that then has to be refunded outside the system, and a
        // DATEV export claiming more turnover than was invoiced.
        TestFixture fx = createTenantAndInvoice();

        assertThatThrownBy(() -> asUser(fx, () -> paymentService.recordManualPayment(
            fx.invoiceId(), new RecordManualPaymentRequest(fx.totalCents() + 1), "203.0.113.5")))
            .isInstanceOf(ConflictException.class);

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.paidCents()).isZero();
    }

    @Test
    void aStorniertInvoiceCanNoLongerBePaid() {
        // Regression: neither payment path looked at the invoice's status, so
        // a client sitting on a payment link (or a photographer on a stale
        // invoice screen) could still collect against an invoice that had been
        // legally withdrawn underneath them.
        TestFixture fx = createTenantAndInvoice();
        InvoiceResponse storno = asUser(fx, () -> invoiceService.storno(fx.invoiceId(), "203.0.113.5"));

        assertThatThrownBy(() -> asUser(fx, () -> paymentService.recordManualPayment(
            fx.invoiceId(), new RecordManualPaymentRequest(1_000), "203.0.113.5")))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("storniert");

        // Nor is the Storno correction itself a payable document.
        assertThatThrownBy(() -> asUser(fx, () -> paymentService.recordManualPayment(
            storno.id(), new RecordManualPaymentRequest(1_000), "203.0.113.5")))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("Storno correction");
    }

    @Test
    void webhookRejectsInvalidSignature() {
        String payload = paymentIntentSucceededPayload("pi_test_invalid_sig", UUID.randomUUID(), UUID.randomUUID());
        assertThatThrownBy(() -> paymentService.handleWebhookEvent(payload, "t=1,v1=deadbeef"))
            .isInstanceOf(ConflictException.class);
    }

    @Test
    void webhookAppliesPaymentIntentSucceededAndIsIdempotentOnRetry() {
        TestFixture fx = createTenantAndInvoice();
        String stripePaymentIntentId = "pi_test_" + UUID.randomUUID();
        asUser(fx, () -> {
            recordPendingStripePaymentForTest(fx, stripePaymentIntentId);
            return null;
        });

        String payload = paymentIntentSucceededPayload(stripePaymentIntentId, fx.tenantId(), fx.invoiceId());
        String signature = signStripePayload(payload, WEBHOOK_SECRET);

        paymentService.handleWebhookEvent(payload, signature);

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.payments()).hasSize(1);
        assertThat(summary.payments().get(0).status()).isEqualTo("SUCCEEDED");
        assertThat(summary.paidCents()).isEqualTo(fx.totalCents());

        // Stripe explicitly documents at-least-once delivery — a retried
        // event must be a no-op, not double-record the payment or re-fire
        // side effects.
        paymentService.handleWebhookEvent(payload, signature);
        InvoicePaymentSummaryResponse summaryAfterRetry = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summaryAfterRetry.payments()).hasSize(1);
    }

    @Test
    void paymentsAreIsolatedByTenantViaRls() {
        TestFixture a = createTenantAndInvoice();
        TestFixture b = createTenantAndInvoice();

        asUser(a, () -> paymentService.recordManualPayment(
            a.invoiceId(), new RecordManualPaymentRequest(null), "203.0.113.5"));

        // RLS makes the invoice itself invisible to tenant B — the summary
        // 404s rather than resolving with empty/wrong data, which is
        // actually the stronger guarantee: there's no code path here that
        // could leak tenant A's payments to B, because the join point
        // (the invoice) is unreachable in the first place.
        assertThatThrownBy(() -> asUser(b, () -> paymentService.getSummary(a.invoiceId())))
            .isInstanceOf(com.photographplatform.api.common.exception.NotFoundException.class);
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private record TestFixture(UUID tenantId, UUID userId, UUID invoiceId, int totalCents) {
    }

    private TestFixture createTenantAndInvoice() {
        UUID tenantId = tenantRepository.save(tenantWithBillingProfile()).getId();
        UUID userId = asTenant(tenantId, () -> {
            User user = new User(tenantId, "u-" + UUID.randomUUID() + "@example.test", "hash", "Anna");
            return userRepository.save(user).getId();
        });
        UUID bookingId = asTenant(tenantId, () -> {
            Booking booking = new Booking("Maria Kellner", "maria@example.test", LocalDate.now().plusDays(30));
            booking.setTenantId(tenantId);
            return bookingRepository.save(booking).getId();
        });

        InvoiceResponse invoice = asUserRaw(tenantId, userId, () -> invoiceService.issueForBooking(
            bookingId,
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Hochzeitspaket", BigDecimal.ONE, 100_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5"));

        return new TestFixture(tenantId, userId, invoice.id(), invoice.totalCents());
    }

    private Tenant tenantWithBillingProfile() {
        Tenant tenant = new Tenant(
            "payment-test-" + UUID.randomUUID(),
            "billing-" + UUID.randomUUID() + "@example.test");
        tenant.setBusinessName("Anna Fotografie");
        tenant.setAddressLine1("Musterstraße 1");
        tenant.setPostalCode("10115");
        tenant.setCity("Berlin");
        tenant.setCountry("DE");
        tenant.setTaxMode(TaxMode.REGELBESTEUERUNG);
        return tenant;
    }

    @Autowired
    private com.photographplatform.api.payment.repository.PaymentRepository paymentRepositoryField;

    /**
     * Directly persists a PENDING Stripe-method payment row, bypassing
     * {@code createStripePaymentIntent} (which needs a live Stripe call) —
     * exercises the webhook's own update logic in isolation.
     */
    private void recordPendingStripePaymentForTest(TestFixture fx, String stripePaymentIntentId) {
        var payment = new com.photographplatform.api.payment.domain.Payment(
            fx.tenantId(), fx.invoiceId(), PaymentMethod.CARD, fx.totalCents(), stripePaymentIntentId);
        paymentRepositoryField.save(payment);
    }

    private String paymentIntentSucceededPayload(String paymentIntentId, UUID tenantId, UUID invoiceId) {
        long now = Instant.now().getEpochSecond();
        return """
            {
              "id": "evt_test_%s",
              "object": "event",
              "api_version": "2024-06-20",
              "created": %d,
              "type": "payment_intent.succeeded",
              "data": {
                "object": {
                  "id": "%s",
                  "object": "payment_intent",
                  "amount": 100000,
                  "currency": "eur",
                  "status": "succeeded",
                  "metadata": {
                    "tenant_id": "%s",
                    "invoice_id": "%s"
                  }
                }
              }
            }
            """.formatted(UUID.randomUUID(), now, paymentIntentId, tenantId, invoiceId);
    }

    private String signStripePayload(String payload, String secret) {
        long timestamp = Instant.now().getEpochSecond();
        String signedPayload = timestamp + "." + payload;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(signedPayload.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return "t=" + timestamp + ",v1=" + hex;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private <T> T asUser(TestFixture fx, java.util.function.Supplier<T> action) {
        return asUserRaw(fx.tenantId(), fx.userId(), action);
    }

    private <T> T asUserRaw(UUID tenantId, UUID userId, java.util.function.Supplier<T> action) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(userId.toString(), null));
        TenantContext.setTenant(tenantId.toString());
        try {
            return action.get();
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    private <T> T asTenant(UUID tenantId, java.util.function.Supplier<T> action) {
        TenantContext.setTenant(tenantId.toString());
        try {
            return action.get();
        } finally {
            TenantContext.clear();
        }
    }
}
