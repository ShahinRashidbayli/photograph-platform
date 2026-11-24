package com.photographplatform.api.invoice;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CustomerBookingResponse;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingQueryService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.util.BusinessZone;
import com.photographplatform.api.invoice.domain.TaxCategory;
import com.photographplatform.api.invoice.dto.CreateInvoiceLineItemRequest;
import com.photographplatform.api.invoice.dto.CreateInvoiceRequest;
import com.photographplatform.api.invoice.dto.InvoiceResponse;
import com.photographplatform.api.invoice.service.InvoiceService;
import com.photographplatform.api.invoice.service.SettlementPeriods;
import com.photographplatform.api.payment.domain.PaymentMethod;
import com.photographplatform.api.payment.dto.CreatePaymentIntentRequest;
import com.photographplatform.api.payment.dto.RecordManualPaymentRequest;
import com.photographplatform.api.payment.service.PaymentService;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.tenant.domain.TaxMode;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A Customer pays invoice A, the photographer withdraws A with a Storno and
 * issues a replacement: the money already paid is a Carried-over payment and
 * counts against the booking's Live invoices (ADR-004 §2), so the replacement
 * never asks for it a second time.
 *
 * <p>Everything goes through the real services, the payment refusal included:
 * the refusal has to follow from the Outstanding amount that {@code
 * Settlement#lockForPayment} hands the payment path, not from a check of its
 * own. The studio is a Kleinunternehmer, so an invoice's total is its line
 * price and every amount below is a literal.
 */
class CarriedOverPaymentIT extends IntegrationTestBase {

    private static final String IP = "203.0.113.67";

    @Autowired private InvoiceService invoiceService;
    @Autowired private PaymentService paymentService;
    @Autowired private BookingQueryService bookingQueryService;
    @Autowired private SettlementPeriods settlementPeriods;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private PlatformTransactionManager txManager;
    @Autowired private Clock clock;

    @MockitoBean
    private R2StorageService r2StorageService;

    @Test
    void aReplacementForTheSameAmountIsAlreadyPaidAndTakesNoFurtherPayment() {
        Studio studio = studio();
        InvoiceResponse a = issue(studio, 100_000);
        payInFull(studio, a);
        storno(studio, a);
        InvoiceResponse b = issue(studio, 100_000);

        InvoiceResponse replacement = invoice(studio, b);
        assertThat(replacement.outstandingCents()).isZero();
        assertThat(replacement.collectable()).isFalse();
        assertThat(staffBooking(studio).paymentState()).isEqualTo("PAID");

        assertThatThrownBy(() -> asStaff(studio, () -> paymentService.recordManualPayment(
            b.id(), new RecordManualPaymentRequest(100_000), IP)))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("exceeds the 0 cents outstanding");
        assertThat(collectedThisMonth(studio)).isEqualTo(100_000);
    }

    /**
     * The card path decides from the same Outstanding amount, so it refuses
     * before Stripe is ever asked: this deployment has no Stripe client, and
     * reaching for one would fail with a different message.
     */
    @Test
    void aReplacementAlreadyPaidByACarriedOverPaymentTakesNoCardPayment() {
        Studio studio = studio();
        connectStripe(studio);
        InvoiceResponse a = issue(studio, 100_000);
        payInFull(studio, a);
        storno(studio, a);
        InvoiceResponse b = issue(studio, 100_000);

        assertThatThrownBy(() -> asStaff(studio, () -> paymentService.createStripePaymentIntent(
            b.id(), new CreatePaymentIntentRequest(PaymentMethod.CARD), IP)))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("already fully paid");
        assertThat(collectedThisMonth(studio)).isEqualTo(100_000);
    }

    @Test
    void aLargerReplacementOwesOnlyTheDifference() {
        Studio studio = studio();
        InvoiceResponse a = issue(studio, 100_000);
        payInFull(studio, a);
        storno(studio, a);
        InvoiceResponse b = issue(studio, 150_000);

        InvoiceResponse replacement = invoice(studio, b);
        assertThat(replacement.outstandingCents()).isEqualTo(50_000);
        assertThat(replacement.collectable()).isTrue();
        assertThat(collectedThisMonth(studio)).isEqualTo(100_000);
    }

    /**
     * Nothing asks for the money any more, but it was Collected and the studio
     * still holds it. The payment state keeps its usual value; the Credit is
     * what tells the photographer. The Customer's own booking carries no
     * Credit field at all: the studio decides what happens to it.
     */
    @Test
    void withoutAReplacementThePaymentIsCreditOnTheStaffBooking() {
        Studio studio = studio();
        InvoiceResponse a = issue(studio, 100_000);
        payInFull(studio, a);
        storno(studio, a);

        BookingResponse staff = staffBooking(studio);
        assertThat(staff.creditCents()).isEqualTo(100_000);
        assertThat(staff.paymentState()).isEqualTo("NOT_INVOICED");

        CustomerBookingResponse own = customerBooking(studio);
        assertThat(own.paymentState()).isEqualTo("NOT_INVOICED");
        assertThat(collectedThisMonth(studio)).isEqualTo(100_000);
    }

    @Test
    void aSmallerReplacementIsPaidAndTheRestIsCredit() {
        Studio studio = studio();
        InvoiceResponse a = issue(studio, 100_000);
        payInFull(studio, a);
        storno(studio, a);
        InvoiceResponse b = issue(studio, 80_000);

        assertThat(invoice(studio, b).collectable()).isFalse();
        BookingResponse staff = staffBooking(studio);
        assertThat(staff.paymentState()).isEqualTo("PAID");
        assertThat(staff.creditCents()).isEqualTo(20_000);
        assertThat(collectedThisMonth(studio)).isEqualTo(100_000);
    }

    @Test
    void aCarriedOverPaymentFillsTheOldestLiveInvoiceFirst() {
        Studio studio = studio();
        InvoiceResponse a = issue(studio, 100_000);
        payInFull(studio, a);
        storno(studio, a);
        InvoiceResponse older = issue(studio, 60_000);
        InvoiceResponse newer = issue(studio, 60_000);

        assertThat(invoice(studio, older).outstandingCents()).isZero();
        assertThat(invoice(studio, older).collectable()).isFalse();
        assertThat(invoice(studio, newer).outstandingCents()).isEqualTo(20_000);
        assertThat(staffBooking(studio).creditCents()).isZero();
        assertThat(collectedThisMonth(studio)).isEqualTo(100_000);
    }

    // ── fixture ──────────────────────────────────────────────────────────────

    private record Studio(UUID tenantId, UUID photographerId, UUID customerId, UUID bookingId) {
    }

    private Studio studio() {
        UUID tenantId = new TransactionTemplate(txManager).execute(status -> {
            Tenant tenant = new Tenant(
                "carried-over-" + UUID.randomUUID(), "billing-" + UUID.randomUUID() + "@example.test");
            tenant.setBusinessName("Anna Fotografie");
            tenant.setAddressLine1("Musterstraße 1");
            tenant.setPostalCode("10115");
            tenant.setCity("Berlin");
            tenant.setCountry("DE");
            tenant.setTaxId("21/815/08150");
            tenant.setTaxMode(TaxMode.KLEINUNTERNEHMER);
            return tenantRepository.save(tenant).getId();
        });
        String customerEmail = "maria-" + UUID.randomUUID() + "@example.test";
        UUID photographerId = inTenant(tenantId, () -> userRepository.save(new User(
            tenantId, "anna-" + UUID.randomUUID() + "@example.test", "hash", "Anna")).getId());
        UUID customerId = inTenant(tenantId, () -> userRepository.save(new User(
            tenantId, customerEmail, "hash", "Maria Kellner")).getId());
        UUID bookingId = inTenant(tenantId, () -> {
            Booking booking = new Booking("Maria Kellner", customerEmail, LocalDate.now(clock).plusDays(30));
            booking.setTenantId(tenantId);
            return bookingRepository.save(booking).getId();
        });
        return new Studio(tenantId, photographerId, customerId, bookingId);
    }

    /** Past the Connect gate, so the card path gets as far as the Outstanding amount. */
    private void connectStripe(Studio studio) {
        inTenant(studio.tenantId(), () -> {
            Tenant tenant = tenantRepository.findById(studio.tenantId()).orElseThrow();
            tenant.setStripeAccountId("acct_test_" + UUID.randomUUID().toString().substring(0, 8));
            tenant.applyStripeCapabilities(true, true, true);
            return tenantRepository.save(tenant);
        });
    }

    private InvoiceResponse issue(Studio studio, int cents) {
        return asStaff(studio, () -> invoiceService.issueForBooking(
            studio.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Hochzeitspaket", BigDecimal.ONE, cents, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            IP));
    }

    private void payInFull(Studio studio, InvoiceResponse invoice) {
        asStaff(studio, () -> paymentService.recordManualPayment(
            invoice.id(), new RecordManualPaymentRequest(invoice.totalCents()), IP));
    }

    private void storno(Studio studio, InvoiceResponse invoice) {
        asStaff(studio, () -> invoiceService.storno(invoice.id(), IP));
    }

    private InvoiceResponse invoice(Studio studio, InvoiceResponse invoice) {
        return asStaff(studio, () -> invoiceService.get(invoice.id()));
    }

    /** The booking as the photographer's booking list, and so the staff booking detail, receives it. */
    private BookingResponse staffBooking(Studio studio) {
        return asStaff(studio, () -> bookingQueryService.listForPhotographer(null, 0, 20)).stream()
            .filter(b -> b.id().equals(studio.bookingId()))
            .findFirst()
            .orElseThrow();
    }

    /** The same booking as the Customer's own portal receives it. */
    private CustomerBookingResponse customerBooking(Studio studio) {
        return asUser(studio.tenantId(), studio.customerId(),
            () -> bookingQueryService.getOwnBookings(null, 0, 20)).stream()
            .filter(b -> b.id().equals(studio.bookingId()))
            .findFirst()
            .orElseThrow();
    }

    /** Collected in the current Berlin month, the period every payment above lands in. */
    private long collectedThisMonth(Studio studio) {
        LocalDate today = LocalDate.ofInstant(clock.instant(), BusinessZone.ID);
        return inTenant(studio.tenantId(), () -> settlementPeriods.ofYear(studio.tenantId(), today.getYear()))
            .months().get(today.getMonthValue() - 1).collectedCents();
    }

    private <T> T asStaff(Studio studio, Supplier<T> action) {
        return asUser(studio.tenantId(), studio.photographerId(), action);
    }

    private <T> T asUser(UUID tenantId, UUID userId, Supplier<T> action) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(userId.toString(), null));
        try {
            return inTenant(tenantId, action);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private <T> T inTenant(UUID tenantId, Supplier<T> action) {
        TenantContext.setTenant(tenantId.toString());
        try {
            return action.get();
        } finally {
            TenantContext.clear();
        }
    }
}
