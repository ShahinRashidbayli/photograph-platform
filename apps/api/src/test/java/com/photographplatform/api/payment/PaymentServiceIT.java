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
import com.photographplatform.api.invoice.service.Settlement;
import com.photographplatform.api.payment.domain.PaymentMethod;
import com.photographplatform.api.payment.dto.CreatePaymentIntentRequest;
import com.photographplatform.api.payment.dto.InvoicePaymentSummaryResponse;
import com.photographplatform.api.payment.dto.PaymentResponse;
import com.photographplatform.api.payment.dto.RecordManualPaymentRequest;
import com.photographplatform.api.payment.service.PaymentService;
import com.photographplatform.api.payment.service.StripeWebhookService;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.domain.TaxMode;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

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
    @Autowired private StripeWebhookService webhookService;
    @Autowired private InvoiceService invoiceService;
    @Autowired private Settlement settlement;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private PlatformTransactionManager txManager;
    @Autowired private EntityManager entityManager;

    @MockitoBean
    private R2StorageService r2StorageService;

    @DynamicPropertySource
    static void stripeProperties(DynamicPropertyRegistry registry) {
        // Only the webhook secret — app.stripe.secret-key stays unset so the
        // StripeClient bean stays absent, exactly like a real deployment
        // that hasn't configured card/SEPA yet.
        registry.add("app.stripe.webhook-secret", () -> WEBHOOK_SECRET);
    }

    /**
     * The Connect gate, checked before anything else on the card path. A
     * photographer who hasn't finished Stripe's hosted onboarding has no
     * account for the charge to land in, and the platform must not quietly
     * collect on its own account instead — the invoice names <em>them</em> as
     * the issuer under §14 UStG. The client is told to pay by Überweisung,
     * which is a route they can actually take, hence 409 rather than a 500.
     */
    @Test
    void cardPaymentIsRejectedWhenPhotographerHasNotConnectedStripe() {
        TestFixture fx = createTenantAndInvoice();
        assertThatThrownBy(() -> asUser(fx, () -> paymentService.createStripePaymentIntent(
            fx.invoiceId(), new CreatePaymentIntentRequest(PaymentMethod.CARD), "203.0.113.5")))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("online payments");
    }

    /**
     * Past the Connect gate, a deployment with no Stripe credentials at all.
     *
     * <p>A 409, not a 500: running on bank transfer alone is a supported
     * configuration, not a server fault, and the client can act on the answer
     * by paying the invoice another way. It is also the same exception {@code
     * StripeConnectService} raises for the same condition — the two used to
     * disagree, which made "is Stripe available?" answerable differently
     * depending on which endpoint the frontend happened to ask.
     */
    @Test
    void cardPaymentIsRejectedWhenStripeNotConfigured() {
        TestFixture fx = createTenantAndInvoice();
        connectStripe(fx.tenantId());

        assertThatThrownBy(() -> asUser(fx, () -> paymentService.createStripePaymentIntent(
            fx.invoiceId(), new CreatePaymentIntentRequest(PaymentMethod.CARD), "203.0.113.5")))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("Stripe");
    }

    /**
     * Überweisung predates Connect and must stay reachable without it —
     * it is the fallback the Connect gate above points the client at.
     */
    @Test
    void manualPaymentWorksWithoutAStripeConnection() {
        TestFixture fx = createTenantAndInvoice();

        PaymentResponse payment = asUser(fx, () -> paymentService.recordManualPayment(
            fx.invoiceId(), new RecordManualPaymentRequest(null), "203.0.113.5"));

        assertThat(payment.status()).isEqualTo("SUCCEEDED");
        assertThat(payment.applicationFeeCents()).isZero();
    }

    /** Marks the tenant as having completed Stripe Express onboarding. */
    private void connectStripe(UUID tenantId) {
        asTenant(tenantId, () -> {
            Tenant tenant = tenantRepository.findById(tenantId).orElseThrow();
            tenant.setStripeAccountId("acct_test_" + UUID.randomUUID().toString().substring(0, 8));
            tenant.applyStripeCapabilities(true, true, true);
            return tenantRepository.save(tenant);
        });
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
    void aFullyPaidInvoiceTakesNoFurtherPayment() {
        TestFixture fx = createTenantAndInvoice();
        asUser(fx, () -> paymentService.recordManualPayment(
            fx.invoiceId(), new RecordManualPaymentRequest(null), "203.0.113.5"));

        // Defaulting to the Outstanding amount books nothing...
        assertThatThrownBy(() -> asUser(fx, () -> paymentService.recordManualPayment(
            fx.invoiceId(), new RecordManualPaymentRequest(null), "203.0.113.5")))
            .isInstanceOf(ConflictException.class);
        // ...and any explicit amount is more than is Outstanding.
        assertThatThrownBy(() -> asUser(fx, () -> paymentService.recordManualPayment(
            fx.invoiceId(), new RecordManualPaymentRequest(1), "203.0.113.5")))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("exceeds the 0 cents outstanding");

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.payments()).hasSize(1);
        assertThat(summary.paidCents()).isEqualTo(fx.totalCents());
    }

    /**
     * Two payment attempts on one invoice cannot both decide from the same
     * Outstanding amount: whoever holds the invoice's lock goes first, and the
     * other is refused outright (NOWAIT) rather than queued.
     *
     * <p>The first attempt is held open on the lock itself, through the same
     * {@code Settlement#lockForPayment} both payment paths take, because two
     * racing calls to the service are not guaranteed to overlap (see {@code
     * BookingConcurrencyIT} for why a race that might not happen proves
     * nothing).
     */
    @Test
    void aPaymentAttemptWhileAnotherHoldsTheInvoiceIsRefused() throws Exception {
        TestFixture fx = createTenantAndInvoice();
        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<?> first = pool.submit(() -> asUser(fx, () -> new TransactionTemplate(txManager)
                .execute(status -> {
                    settlement.lockForPayment(fx.invoiceId());
                    locked.countDown();
                    awaitQuietly(release);
                    return null;
                })));
            assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue();

            assertThatThrownBy(() -> asUser(fx, () -> paymentService.recordManualPayment(
                fx.invoiceId(), new RecordManualPaymentRequest(null), "203.0.113.5")))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("already being processed");

            release.countDown();
            first.get(10, TimeUnit.SECONDS);
        } finally {
            release.countDown();
            pool.shutdownNow();
        }

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.paidCents()).isZero();
    }

    /**
     * A booking's invoices are settled together, so a payment on one of them is
     * decided from its siblings as well. A Storno of a paid sibling turns that
     * sibling's payment into a Carried-over payment, which lowers what this
     * invoice still owes; landing between the check and the write, it let the
     * payment through for money that was no longer owed, and the Customer paid
     * twice.
     *
     * <p>The Storno is held open once it has written the STORNIERT flip, so it
     * holds the sibling's row lock while the payment is attempted.
     */
    @Test
    void aPaymentWhileASiblingInvoiceOfTheBookingIsBeingStorniertIsRefused() throws Exception {
        TestFixture fx = createTenantAndInvoice();
        asUser(fx, () -> paymentService.recordManualPayment(
            fx.invoiceId(), new RecordManualPaymentRequest(null), "203.0.113.5"));
        InvoiceResponse replacement = issueForTheSameBooking(fx);
        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<?> storno = pool.submit(() -> asUser(fx, () -> new TransactionTemplate(txManager)
                .execute(status -> {
                    invoiceService.storno(fx.invoiceId(), "203.0.113.5");
                    entityManager.flush();
                    locked.countDown();
                    awaitQuietly(release);
                    return null;
                })));
            assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue();

            assertThatThrownBy(() -> asUser(fx, () -> paymentService.recordManualPayment(
                replacement.id(), new RecordManualPaymentRequest(null), "203.0.113.5")))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("already being processed");

            release.countDown();
            storno.get(10, TimeUnit.SECONDS);
        } finally {
            release.countDown();
            pool.shutdownNow();
        }

        // The Storniert invoice's payment already covers the replacement.
        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(replacement.id()));
        assertThat(summary.paidCents()).isZero();
        assertThat(summary.outstandingCents()).isZero();
    }

    private static void awaitQuietly(CountDownLatch latch) {
        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
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
        assertThatThrownBy(() -> webhookService.handle(payload, "t=1,v1=deadbeef"))
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

        webhookService.handle(payload, signature);

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.payments()).hasSize(1);
        assertThat(summary.payments().get(0).status()).isEqualTo("SUCCEEDED");
        assertThat(summary.paidCents()).isEqualTo(fx.totalCents());

        // Stripe explicitly documents at-least-once delivery — a retried
        // event must be a no-op, not double-record the payment or re-fire
        // side effects.
        webhookService.handle(payload, signature);
        InvoicePaymentSummaryResponse summaryAfterRetry = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summaryAfterRetry.payments()).hasSize(1);
    }

    /**
     * The signature proves an event came from Stripe, not that it came from
     * this payment's merchant. A webhook endpoint serves every connected
     * account at once, so a settlement event stamped with a different {@code
     * acct_…} than the row was created on must not settle it — otherwise one
     * photographer's charge could mark another's invoice paid.
     */
    @Test
    void webhookRefusesToSettleAPaymentThatBelongsToAnotherConnectedAccount() {
        TestFixture fx = createTenantAndInvoice();
        String intentId = "pi_test_" + UUID.randomUUID();
        asUser(fx, () -> {
            recordPendingStripePaymentForTest(fx, intentId, "acct_theRightOne");
            return null;
        });

        String payload = paymentIntentPayload(
            "evt_test_" + UUID.randomUUID(), "payment_intent.succeeded", intentId,
            fx.tenantId(), fx.invoiceId(), "acct_someoneElse");
        webhookService.handle(payload, signStripePayload(payload, WEBHOOK_SECRET));

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.payments().get(0).status()).isEqualTo("PENDING");
        assertThat(summary.paidCents()).isZero();
    }

    /**
     * The row's amount is what we <em>asked</em> Stripe for. What settles the
     * invoice has to be what Stripe says actually arrived.
     *
     * <p>Marking the row SUCCEEDED at the requested amount treats the two as
     * interchangeable, and {@code outstandingCents} sums requested amounts to
     * decide an invoice is paid — so a partial capture, or an amount edited in
     * the Stripe dashboard, books revenue that never landed. The invoice reads
     * settled, the DATEV export agrees, and only the Stripe dashboard disagrees.
     */
    @Test
    void webhookRecordsTheAmountStripeActuallyCollectedNotTheAmountRequested() {
        TestFixture fx = createTenantAndInvoice();
        String intentId = "pi_test_" + UUID.randomUUID();
        asUser(fx, () -> {
            recordPendingStripePaymentForTest(fx, intentId);
            return null;
        });

        int actuallyCollected = fx.totalCents() - 2500;
        String payload = paymentIntentPayloadWithAmountReceived(
            intentId, fx.tenantId(), fx.invoiceId(), fx.totalCents(), actuallyCollected);
        webhookService.handle(payload, signStripePayload(payload, WEBHOOK_SECRET));

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.payments().get(0).status()).isEqualTo("SUCCEEDED");
        assertThat(summary.paidCents()).isEqualTo(actuallyCollected);
        // The point of the whole thing: the invoice is not settled.
        assertThat(summary.outstandingCents()).isEqualTo(2500);
    }

    /** The ordinary case must not be disturbed by the correction above. */
    @Test
    void webhookLeavesTheAmountAloneWhenStripeCollectedTheFullRequest() {
        TestFixture fx = createTenantAndInvoice();
        String intentId = "pi_test_" + UUID.randomUUID();
        asUser(fx, () -> {
            recordPendingStripePaymentForTest(fx, intentId);
            return null;
        });

        String payload = paymentIntentPayloadWithAmountReceived(
            intentId, fx.tenantId(), fx.invoiceId(), fx.totalCents(), fx.totalCents());
        webhookService.handle(payload, signStripePayload(payload, WEBHOOK_SECRET));

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.paidCents()).isEqualTo(fx.totalCents());
        assertThat(summary.outstandingCents()).isZero();
    }

    /**
     * The claim in the idempotency ledger is a one-way door, so it must only be
     * kept when the event is genuinely finished with. A settlement event whose
     * payment row isn't visible yet is not finished with: it fails, and the
     * <em>same</em> event redelivered later still settles the invoice.
     *
     * <p>Without this the failure is invisible and permanent — the first
     * delivery marks the event processed, every retry is dropped as a
     * duplicate, and an invoice the client has actually paid stays outstanding
     * forever behind a single WARN line.
     */
    @Test
    void webhookRetriesASettlementEventWhoseRowIsNotVisibleYet() {
        TestFixture fx = createTenantAndInvoice();
        String intentId = "pi_test_" + UUID.randomUUID();
        String eventId = "evt_test_" + UUID.randomUUID();
        String payload = paymentIntentPayload(
            eventId, "payment_intent.succeeded", intentId, fx.tenantId(), fx.invoiceId(), null);
        String signature = signStripePayload(payload, WEBHOOK_SECRET);

        // First delivery arrives before the row exists.
        assertThatThrownBy(() -> webhookService.handle(payload, signature))
            .isInstanceOf(IllegalStateException.class);

        asUser(fx, () -> {
            recordPendingStripePaymentForTest(fx, intentId);
            return null;
        });

        // Stripe redelivers the same event id. The claim was rolled back with
        // the failed transaction, so this one is allowed to do the work.
        webhookService.handle(payload, signature);

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.payments().get(0).status()).isEqualTo("SUCCEEDED");
        assertThat(summary.paidCents()).isEqualTo(fx.totalCents());
    }

    /**
     * The other half of that distinction: an event we deliberately don't act on
     * is finished with on first sight, even though it has no row either.
     * {@code payment_intent.created} fires while its own row is still being
     * committed, so treating "no row" as retryable for every event type would
     * turn every intent creation into a burst of failing redeliveries.
     */
    @Test
    void webhookQuietlyIgnoresPaymentIntentEventsItDoesNotActOn() {
        TestFixture fx = createTenantAndInvoice();
        String payload = paymentIntentPayload(
            "evt_test_" + UUID.randomUUID(), "payment_intent.created",
            "pi_test_" + UUID.randomUUID(), fx.tenantId(), fx.invoiceId(), null);

        webhookService.handle(payload, signStripePayload(payload, WEBHOOK_SECRET));

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.payments()).isEmpty();
    }

    /**
     * The database backstop behind the "one live intent per invoice" rule.
     *
     * <p>{@code createStripePaymentIntent} checks for an open intent before
     * minting one, but a check in application code is only as good as the
     * transaction isolating it — two concurrent calls both see no open intent.
     * V18's partial unique index is what actually makes a second live charge
     * for the same balance impossible, and this pins it: without the index
     * both rows insert happily.
     */
    @Test
    void aSecondOpenIntentForTheSameInvoiceIsRejectedByTheDatabase() {
        TestFixture fx = createTenantAndInvoice();
        asUser(fx, () -> {
            recordPendingStripePaymentForTest(fx, "pi_test_" + UUID.randomUUID());
            return null;
        });

        assertThatThrownBy(() -> asUser(fx, () -> {
            recordPendingStripePaymentForTest(fx, "pi_test_" + UUID.randomUUID());
            return null;
        })).isInstanceOf(DataIntegrityViolationException.class);
    }

    /**
     * The index must not get in the way of the legitimate case it looks like.
     * An invoice may collect several bank transfers — a deposit, then the
     * balance — and those rows are written straight to SUCCEEDED, which is why
     * the constraint is partial on PENDING rather than on the invoice.
     */
    @Test
    void severalManualPaymentsAgainstOneInvoiceAreStillAllowed() {
        TestFixture fx = createTenantAndInvoice();

        asUser(fx, () -> paymentService.recordManualPayment(
            fx.invoiceId(), new RecordManualPaymentRequest(40_000), "203.0.113.5"));
        asUser(fx, () -> paymentService.recordManualPayment(
            fx.invoiceId(), new RecordManualPaymentRequest(30_000), "203.0.113.5"));

        InvoicePaymentSummaryResponse summary = asUser(fx, () -> paymentService.getSummary(fx.invoiceId()));
        assertThat(summary.payments()).hasSize(2);
        assertThat(summary.paidCents()).isEqualTo(70_000);
        assertThat(summary.outstandingCents()).isEqualTo(fx.totalCents() - 70_000);
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

    private record TestFixture(UUID tenantId, UUID userId, UUID bookingId, UUID invoiceId, int totalCents) {
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

        InvoiceResponse invoice = asUserRaw(tenantId, userId, () -> issue(bookingId));

        return new TestFixture(tenantId, userId, bookingId, invoice.id(), invoice.totalCents());
    }

    /** A second invoice for the fixture's booking, for the same amount. */
    private InvoiceResponse issueForTheSameBooking(TestFixture fx) {
        return asUser(fx, () -> issue(fx.bookingId()));
    }

    private InvoiceResponse issue(UUID bookingId) {
        return invoiceService.issueForBooking(
            bookingId,
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Hochzeitspaket", BigDecimal.ONE, 100_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5");
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
        tenant.setTaxId("21/815/08150");
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
        recordPendingStripePaymentForTest(fx, stripePaymentIntentId, null);
    }

    /** As above, but pinned to a specific connected account. */
    private void recordPendingStripePaymentForTest(
        TestFixture fx, String stripePaymentIntentId, String connectedAccountId) {
        var payment = new com.photographplatform.api.payment.domain.Payment(
            fx.tenantId(), fx.invoiceId(), PaymentMethod.CARD, fx.totalCents(),
            stripePaymentIntentId, connectedAccountId, 0);
        paymentRepositoryField.save(payment);
    }

    /**
     * A settled intent that reports {@code amount_received} separately from
     * {@code amount} — which is how Stripe describes a partial capture, and the
     * field the other payloads here omit entirely.
     */
    private String paymentIntentPayloadWithAmountReceived(
        String paymentIntentId, UUID tenantId, UUID invoiceId, int amount, int amountReceived) {
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
                  "amount": %d,
                  "amount_received": %d,
                  "currency": "eur",
                  "status": "succeeded",
                  "metadata": {
                    "tenant_id": "%s",
                    "invoice_id": "%s"
                  }
                }
              }
            }
            """.formatted(
                UUID.randomUUID(), now, paymentIntentId, amount, amountReceived,
                tenantId, invoiceId);
    }

    private String paymentIntentSucceededPayload(String paymentIntentId, UUID tenantId, UUID invoiceId) {
        return paymentIntentPayload(
            "evt_test_" + UUID.randomUUID(), "payment_intent.succeeded", paymentIntentId,
            tenantId, invoiceId, null);
    }

    /**
     * A Stripe event envelope. Takes the event id explicitly so a test can
     * redeliver the <em>same</em> event (which is what idempotency is about)
     * rather than a fresh one that merely looks the same, and takes the
     * connected account because a direct-charge event is stamped with the
     * account it happened on — the field the webhook checks the payment row
     * against.
     */
    private String paymentIntentPayload(
        String eventId, String type, String paymentIntentId,
        UUID tenantId, UUID invoiceId, String connectedAccountId) {
        long now = Instant.now().getEpochSecond();
        String accountLine = connectedAccountId == null
            ? ""
            : "  \"account\": \"" + connectedAccountId + "\",\n";
        return """
            {
              "id": "%s",
              "object": "event",
            %s  "api_version": "2024-06-20",
              "created": %d,
              "type": "%s",
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
            """.formatted(eventId, accountLine, now, type, paymentIntentId, tenantId, invoiceId);
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
