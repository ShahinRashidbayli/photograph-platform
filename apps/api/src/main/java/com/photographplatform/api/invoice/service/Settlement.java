package com.photographplatform.api.invoice.service;

import com.photographplatform.api.booking.domain.BookingPaymentState;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.invoice.domain.BookingSettlement;
import com.photographplatform.api.invoice.domain.Invoice;
import com.photographplatform.api.invoice.domain.InvoiceSettlement;
import com.photographplatform.api.invoice.repository.InvoiceRepository;
import com.photographplatform.api.payment.service.SucceededPayments;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Where an invoice, or all invoices of one booking, stand: what was paid, what
 * is Outstanding, whether it is Overdue. The one place that works it out
 * (ADR-004 §1). Booking, payment and invoice's own responses ask here; none of
 * them reads invoice or payment rows to decide it for themselves.
 *
 * <p>Derived fresh on every call and never stored, so it cannot drift from
 * the rows it is computed from. The rules themselves sit in the two {@code
 * settle} methods, one per invoice and one per booking; a change to what
 * counts as Outstanding or Overdue belongs there, not in a caller.
 */
@Service
public class Settlement {

    private static final Logger LOG = LoggerFactory.getLogger(Settlement.class);

    /**
     * No structured payment terms yet ({@code payment_terms} is free text that
     * nothing parses), so every invoice is due net-14 from its issue date.
     * FU-13 replaces this with a real Due date; only this class changes then.
     */
    private static final int DEFAULT_DUE_DAYS = 14;

    private final InvoiceRepository invoiceRepository;
    private final SucceededPayments succeededPayments;
    private final Clock clock;

    public Settlement(InvoiceRepository invoiceRepository, SucceededPayments succeededPayments, Clock clock) {
        this.invoiceRepository = invoiceRepository;
        this.succeededPayments = succeededPayments;
        this.clock = clock;
    }

    /** One booking. Two queries; a list must use {@link #ofBookings} instead. */
    public BookingSettlement ofBooking(UUID bookingId) {
        return ofBookings(List.of(bookingId)).getOrDefault(bookingId, BookingSettlement.none());
    }

    /**
     * A whole page of bookings in two queries: every invoice of those
     * bookings, then every succeeded total for those invoices.
     *
     * <p><strong>Contract:</strong> the map holds an entry for every id passed
     * in. A booking with no invoice maps to {@link BookingSettlement#none()}
     * rather than being absent, because callers map a whole page through this
     * and one missing key is a null that takes the entire list down.
     */
    public Map<UUID, BookingSettlement> ofBookings(Collection<UUID> bookingIds) {
        if (bookingIds.isEmpty()) {
            return Map.of();
        }
        List<Invoice> invoices = invoiceRepository.findByBookingIdInOrderByIssuedAtDesc(bookingIds);
        Map<UUID, List<Invoice>> invoicesByBooking = invoices.stream()
            .collect(Collectors.groupingBy(Invoice::getBookingId));
        Map<UUID, Long> paidByInvoice = succeededPayments.totalCentsByInvoice(ids(invoices));

        Map<UUID, BookingSettlement> result = new HashMap<>();
        for (UUID bookingId : bookingIds) {
            List<Invoice> bookingInvoices = invoicesByBooking.getOrDefault(bookingId, List.of());
            result.put(bookingId, bookingInvoices.isEmpty()
                ? BookingSettlement.none()
                : settle(bookingInvoices, paidByInvoice));
        }
        return result;
    }

    /** One invoice, by id. 404 if it does not exist or belongs to another tenant (RLS). */
    public InvoiceSettlement ofInvoice(UUID invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new NotFoundException("Invoice not found: " + invoiceId));
        return settle(invoice, succeededPayments.totalCents(invoiceId));
    }

    /**
     * One invoice, with its row locked for the rest of the caller's
     * transaction: the serialisation point for everything that collects money
     * against it. Both payment paths are check-then-act on the Outstanding
     * amount returned here ("no open intent, so mint one", "this amount fits,
     * so book it"), and neither conclusion survives a concurrent writer.
     *
     * <p>{@code MANDATORY} because the lock is only worth anything inside the
     * transaction that then writes the payment; outside one it would be
     * released as soon as the query returned.
     *
     * <p>The lock is NOWAIT (see {@code InvoiceRepository#findByIdForPayment}):
     * a second caller is told to retry with a 409 instead of queueing behind
     * someone else's Stripe round-trip.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public InvoiceSettlement lockForPayment(UUID invoiceId) {
        Invoice invoice;
        try {
            invoice = invoiceRepository.findByIdForPayment(invoiceId)
                .orElseThrow(() -> new NotFoundException("Invoice not found: " + invoiceId));
        } catch (PessimisticLockingFailureException ex) {
            // Someone else is mid-payment on this invoice. Not an error worth a
            // stack trace: by the time the caller looks again the other request
            // has settled, and the amount they would pay may well have changed.
            LOG.info("Invoice {} is locked by another payment operation", invoiceId);
            throw new ConflictException(
                "A payment for this invoice is already being processed. "
                    + "Please reload the page and try again in a moment.");
        }
        return settle(invoice, succeededPayments.totalCents(invoiceId));
    }

    /**
     * Invoices the caller already holds, in one grouped query. Package-private:
     * only {@code InvoiceService} has invoice rows in hand to pass.
     */
    Map<UUID, InvoiceSettlement> ofInvoices(List<Invoice> invoices) {
        Map<UUID, Long> paidByInvoice = succeededPayments.totalCentsByInvoice(ids(invoices));
        return invoices.stream().collect(Collectors.toMap(
            Invoice::getId, inv -> settle(inv, paidByInvoice.getOrDefault(inv.getId(), 0L))));
    }

    private static InvoiceSettlement settle(Invoice invoice, long paidCents) {
        return new InvoiceSettlement(
            invoice, (int) paidCents, (int) Math.max(0, invoice.getTotalCents() - paidCents));
    }

    /**
     * Every invoice's total is summed regardless of status: a Storno's
     * negative total exists to net against the original it withdraws (see
     * {@code InvoiceService#storno}).
     */
    private BookingSettlement settle(List<Invoice> invoices, Map<UUID, Long> paidByInvoice) {
        int invoiced = invoices.stream().mapToInt(Invoice::getTotalCents).sum();
        int paid = invoices.stream()
            .mapToInt(inv -> paidByInvoice.getOrDefault(inv.getId(), 0L).intValue())
            .sum();

        // invoiced <= 0 means every invoice against this booking has been
        // fully storniert. That is "nothing currently owed", the same as never
        // having invoiced — not PAID, which would claim the full quoted total
        // was actually collected.
        if (invoiced <= 0) {
            return new BookingSettlement(BookingPaymentState.NOT_INVOICED, invoiced, paid);
        }
        if (paid >= invoiced) {
            return new BookingSettlement(BookingPaymentState.PAID, invoiced, paid);
        }
        if (invoices.stream().filter(Invoice::isLive).anyMatch(this::isPastDue)) {
            return new BookingSettlement(BookingPaymentState.OVERDUE, invoiced, paid);
        }
        BookingPaymentState state = paid <= 0 ? BookingPaymentState.OPEN : BookingPaymentState.PARTIALLY_PAID;
        return new BookingSettlement(state, invoiced, paid);
    }

    /**
     * Only a Live invoice can be Overdue. A Storniert invoice and its Storno
     * both keep their original {@code issued_at}, so counting them showed a
     * corrected and re-invoiced booking as OVERDUE from the withdrawn
     * document's date while the replacement was still inside its own window.
     */
    private boolean isPastDue(Invoice invoice) {
        return invoice.getIssuedAt().plusDays(DEFAULT_DUE_DAYS).isBefore(OffsetDateTime.now(clock));
    }

    private static List<UUID> ids(List<Invoice> invoices) {
        return invoices.stream().map(Invoice::getId).toList();
    }
}
