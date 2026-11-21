package com.photographplatform.api.invoice;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.util.BusinessZone;
import com.photographplatform.api.invoice.domain.BookingSettlement;
import com.photographplatform.api.invoice.domain.Invoice;
import com.photographplatform.api.invoice.domain.InvoiceSettlement;
import com.photographplatform.api.invoice.repository.InvoiceRepository;
import com.photographplatform.api.invoice.service.Settlement;
import com.photographplatform.api.payment.domain.Payment;
import com.photographplatform.api.payment.domain.PaymentMethod;
import com.photographplatform.api.payment.domain.PaymentStatus;
import com.photographplatform.api.payment.repository.PaymentRepository;
import com.photographplatform.api.payment.service.SucceededPayments;
import com.photographplatform.api.tenant.domain.TaxMode;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static com.photographplatform.api.booking.domain.BookingPaymentState.NOT_INVOICED;
import static com.photographplatform.api.booking.domain.BookingPaymentState.OPEN;
import static com.photographplatform.api.booking.domain.BookingPaymentState.OVERDUE;
import static com.photographplatform.api.booking.domain.BookingPaymentState.PAID;
import static com.photographplatform.api.booking.domain.BookingPaymentState.PARTIALLY_PAID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Settlement through its own interface, against real invoice and payment rows.
 *
 * <p>Invoices are written straight through the repository rather than issued
 * through {@code InvoiceService}, because Overdue depends on {@code issued_at}
 * and issuance stamps that from the application clock. Writing the rows lets
 * each test say "issued on 1 November" outright, and the Settlement under test
 * gets its own fixed clock — the same way {@code GalleryRetentionIT} builds
 * its service.
 */
class SettlementIT extends IntegrationTestBase {

    private static final OffsetDateTime NOV_1 = berlin(2026, 11, 1);
    private static final OffsetDateTime NOV_5 = berlin(2026, 11, 5);
    private static final OffsetDateTime NOV_10 = berlin(2026, 11, 10);
    private static final OffsetDateTime NOV_14 = berlin(2026, 11, 14);
    private static final OffsetDateTime NOV_16 = berlin(2026, 11, 16);
    private static final OffsetDateTime NOV_20 = berlin(2026, 11, 20);
    private static final OffsetDateTime DEC_1 = berlin(2026, 12, 1);

    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private PaymentRepository paymentRepository;
    @Autowired private SucceededPayments succeededPayments;
    /** The proxied bean, for what only the transaction boundary around it can show. */
    @Autowired private Settlement settlementBean;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private PlatformTransactionManager txManager;

    private UUID tenantId;
    private int nextSequence = 1;

    @BeforeEach
    void studio() {
        Tenant tenant = new Tenant(
            "settlement-" + UUID.randomUUID(), "billing-" + UUID.randomUUID() + "@example.test");
        tenantId = new TransactionTemplate(txManager).execute(status -> tenantRepository.save(tenant).getId());
    }

    // ── a booking's settlement ───────────────────────────────────────────────

    /**
     * A page of bookings is mapped through one batch call, so a booking with
     * no invoice has to come back as NOT_INVOICED rather than be missing: one
     * absent key is a null that takes the whole list down, not one row.
     */
    @Test
    void everyRequestedBookingIsSettledEvenWithoutAnInvoice() {
        UUID invoiced = booking();
        UUID uninvoiced = booking();
        invoice(invoiced, 100_000, NOV_1);

        Map<UUID, BookingSettlement> settled =
            inTenant(() -> settlementOn(NOV_5).ofBookings(List.of(invoiced, uninvoiced)));

        assertThat(settled).containsOnlyKeys(invoiced, uninvoiced);
        assertThat(settled.get(uninvoiced)).isEqualTo(new BookingSettlement(NOT_INVOICED, 0, 0));
        assertThat(settled.get(invoiced)).isEqualTo(new BookingSettlement(OPEN, 100_000, 0));
    }

    @Test
    void anUnpaidInvoiceIsOpenUntilItsDueDateAndOverdueAfter() {
        UUID booking = booking();
        invoice(booking, 100_000, NOV_1);

        assertThat(inTenant(() -> settlementOn(NOV_14).ofBooking(booking)))
            .isEqualTo(new BookingSettlement(OPEN, 100_000, 0));
        assertThat(inTenant(() -> settlementOn(NOV_16).ofBooking(booking)))
            .isEqualTo(new BookingSettlement(OVERDUE, 100_000, 0));
    }

    @Test
    void aPartPaymentIsPartiallyPaidUntilTheDueDatePasses() {
        UUID booking = booking();
        pay(invoice(booking, 100_000, NOV_1), 40_000);

        assertThat(inTenant(() -> settlementOn(NOV_5).ofBooking(booking)))
            .isEqualTo(new BookingSettlement(PARTIALLY_PAID, 100_000, 40_000));
        assertThat(inTenant(() -> settlementOn(NOV_16).ofBooking(booking)))
            .isEqualTo(new BookingSettlement(OVERDUE, 100_000, 40_000));
    }

    /** A deposit invoice and a final invoice: the booking is settled across both. */
    @Test
    void aBookingPaidInFullAcrossItsInvoicesIsPaidEvenPastTheDueDate() {
        UUID booking = booking();
        pay(invoice(booking, 30_000, NOV_1), 30_000);
        pay(invoice(booking, 70_000, NOV_5), 70_000);

        assertThat(inTenant(() -> settlementOn(DEC_1).ofBooking(booking)))
            .isEqualTo(new BookingSettlement(PAID, 100_000, 100_000));
    }

    /**
     * A booking is Overdue when one of its invoices is. The deposit's Due date
     * has passed, but it is paid; the final invoice is still inside its own.
     */
    @Test
    void aPaidDepositPastItsDueDateDoesNotMakeTheBookingOverdue() {
        UUID booking = booking();
        pay(invoice(booking, 30_000, NOV_1), 30_000);
        invoice(booking, 70_000, NOV_14);

        assertThat(inTenant(() -> settlementOn(NOV_20).ofBooking(booking)))
            .isEqualTo(new BookingSettlement(PARTIALLY_PAID, 100_000, 30_000));
    }

    /**
     * Storniert and its Storno net to zero, which is nothing owed — not PAID,
     * which would claim the quoted total was collected.
     */
    @Test
    void aFullyStorniertBookingIsNotInvoiced() {
        UUID booking = booking();
        storno(invoice(booking, 100_000, NOV_1), NOV_5);

        assertThat(inTenant(() -> settlementOn(DEC_1).ofBooking(booking)))
            .isEqualTo(new BookingSettlement(NOT_INVOICED, 0, 0));
    }

    /**
     * The withdrawn invoice and its Storno keep their own issue dates. Only
     * the Live replacement's date decides Overdue.
     */
    @Test
    void aWithdrawnInvoiceDoesNotMakeTheBookingOverdue() {
        UUID booking = booking();
        storno(invoice(booking, 100_000, NOV_1), NOV_10);
        invoice(booking, 80_000, NOV_10);

        assertThat(inTenant(() -> settlementOn(NOV_20).ofBooking(booking)))
            .isEqualTo(new BookingSettlement(OPEN, 80_000, 0));
    }

    // ── one invoice's settlement ─────────────────────────────────────────────

    /** A started card payment is not money yet: only succeeded payments count. */
    @Test
    void anInvoiceOwesItsTotalLessItsSucceededPayments() {
        Invoice invoice = invoice(booking(), 100_000, NOV_1);
        pay(invoice, 40_000);
        startCardPayment(invoice, 60_000);

        InvoiceSettlement settled = inTenant(() -> settlementOn(NOV_5).ofInvoice(invoice.getId()));

        assertThat(settled.paidCents()).isEqualTo(40_000);
        assertThat(settled.outstandingCents()).isEqualTo(60_000);
    }

    /**
     * Fourteen days from the day printed on the invoice, which is the Berlin
     * calendar day. Issued at half past midnight on 1 November, the row holds
     * 31 October in UTC; counting from that would make it due a day early.
     */
    @Test
    void aLiveInvoiceIsDueFourteenDaysAfterItsIssueDate() {
        Invoice invoice = invoice(booking(), 100_000, berlin(2026, 11, 1, 0, 30));

        InvoiceSettlement settled = inTenant(() -> settlementOn(NOV_5).ofInvoice(invoice.getId()));

        assertThat(settled.dueDate()).isEqualTo(LocalDate.of(2026, 11, 15));
    }

    /** The Due date is a day: the whole of it is still in time, late evening included. */
    @Test
    void anUnpaidInvoiceIsOverdueOnlyOnceItsDueDateHasPassed() {
        Invoice invoice = invoice(booking(), 100_000, NOV_1);

        InvoiceSettlement onTheDueDate =
            inTenant(() -> settlementOn(berlin(2026, 11, 15, 23, 30)).ofInvoice(invoice.getId()));
        InvoiceSettlement theDayAfter =
            inTenant(() -> settlementOn(berlin(2026, 11, 16, 0, 30)).ofInvoice(invoice.getId()));

        assertThat(onTheDueDate.collectable()).isTrue();
        assertThat(onTheDueDate.overdue()).isFalse();
        assertThat(theDayAfter.collectable()).isTrue();
        assertThat(theDayAfter.overdue()).isTrue();
    }

    /**
     * Neither document of a Storno pair is ever paid, so neither owes
     * anything or has a day to pay it by. The withdrawn invoice used to report
     * its total less its part payment as Outstanding, as if it were still owed.
     */
    @Test
    void aStornoAndTheInvoiceItWithdrawsAreNeverCollectable() {
        Invoice original = invoice(booking(), 100_000, NOV_1);
        pay(original, 40_000);
        Invoice storno = storno(original, NOV_5);

        for (UUID id : List.of(original.getId(), storno.getId())) {
            InvoiceSettlement settled = inTenant(() -> settlementOn(DEC_1).ofInvoice(id));

            assertThat(settled.outstandingCents()).isZero();
            assertThat(settled.collectable()).isFalse();
            assertThat(settled.overdue()).isFalse();
            assertThat(settled.dueDate()).isNull();
        }
    }

    @Test
    void aFullyPaidInvoiceIsNotCollectableEvenPastItsDueDate() {
        Invoice invoice = invoice(booking(), 100_000, NOV_1);
        pay(invoice, 100_000);

        InvoiceSettlement settled = inTenant(() -> settlementOn(DEC_1).ofInvoice(invoice.getId()));

        assertThat(settled.collectable()).isFalse();
        assertThat(settled.overdue()).isFalse();
    }

    @Test
    void aStornoHasNothingOutstanding() {
        Invoice storno = storno(invoice(booking(), 100_000, NOV_1), NOV_5);

        InvoiceSettlement settled = inTenant(() -> settlementOn(NOV_10).ofInvoice(storno.getId()));

        assertThat(settled.outstandingCents()).isZero();
    }

    // ── locking an invoice for payment ───────────────────────────────────────

    /**
     * The lock lives as long as the caller's transaction. Taken outside one,
     * it would be released the moment the query returned, and the payment
     * decided from that Outstanding amount would be unguarded again.
     */
    @Test
    void anInvoiceIsOnlyLockedForPaymentInsideTheCallersTransaction() {
        Invoice invoice = invoice(booking(), 100_000, NOV_1);
        Settlement settlement = settlementBean;

        TenantContext.setTenant(tenantId.toString());
        try {
            assertThatThrownBy(() -> settlement.lockForPayment(invoice.getId()))
                .isInstanceOf(IllegalTransactionStateException.class);
        } finally {
            TenantContext.clear();
        }
        assertThat(inTenant(() -> settlement.lockForPayment(invoice.getId()).outstandingCents()))
            .isEqualTo(100_000);
    }

    // ── fixture ──────────────────────────────────────────────────────────────

    private Settlement settlementOn(OffsetDateTime now) {
        return new Settlement(invoiceRepository, succeededPayments, Clock.fixed(now.toInstant(), BusinessZone.ID));
    }

    private UUID booking() {
        return inTenant(() -> {
            Booking booking = new Booking("Maria Kellner", "maria@example.test", LocalDate.of(2026, 12, 12));
            booking.setTenantId(tenantId);
            return bookingRepository.save(booking).getId();
        });
    }

    private Invoice invoice(UUID bookingId, int totalCents, OffsetDateTime issuedAt) {
        return inTenant(() -> invoiceRepository.save(document(bookingId, totalCents, null, issuedAt)));
    }

    private Invoice document(UUID bookingId, int totalCents, UUID stornoOfId, OffsetDateTime issuedAt) {
        int sequence = nextSequence++;
        return new Invoice(
            tenantId, bookingId, "2026-" + String.format("%04d", sequence), 2026, sequence,
            TaxMode.KLEINUNTERNEHMER,
            new Invoice.Issuer("Anna Fotografie", "Musterstraße 1", null, "10115", "Berlin", "DE",
                "21/815/08150", null),
            new Invoice.Buyer("Maria Kellner", "maria@example.test", null, null, null, null, null, null),
            null, totalCents, 0, totalCents, stornoOfId, issuedAt);
    }

    /** What {@code InvoiceService#storno} leaves behind: a negative counter-document, original flipped. */
    private Invoice storno(Invoice original, OffsetDateTime issuedAt) {
        return inTenant(() -> {
            Invoice storno = invoiceRepository.save(
                document(original.getBookingId(), -original.getTotalCents(), original.getId(), issuedAt));
            Invoice withdrawn = invoiceRepository.findById(original.getId()).orElseThrow();
            withdrawn.markStornied();
            invoiceRepository.save(withdrawn);
            return storno;
        });
    }

    private void pay(Invoice invoice, int cents) {
        inTenant(() -> {
            Payment payment = new Payment(tenantId, invoice.getId(), PaymentMethod.UEBERWEISUNG, cents, null);
            payment.setStatus(PaymentStatus.SUCCEEDED);
            return paymentRepository.save(payment);
        });
    }

    private void startCardPayment(Invoice invoice, int cents) {
        inTenant(() -> paymentRepository.save(new Payment(
            tenantId, invoice.getId(), PaymentMethod.CARD, cents, "pi_test_" + UUID.randomUUID())));
    }

    private <T> T inTenant(Supplier<T> action) {
        TenantContext.setTenant(tenantId.toString());
        try {
            return new TransactionTemplate(txManager).execute(status -> action.get());
        } finally {
            TenantContext.clear();
        }
    }

    private static OffsetDateTime berlin(int year, int month, int day) {
        return berlin(year, month, day, 10, 0);
    }

    private static OffsetDateTime berlin(int year, int month, int day, int hour, int minute) {
        return LocalDateTime.of(year, month, day, hour, minute).atZone(BusinessZone.ID).toOffsetDateTime();
    }
}
