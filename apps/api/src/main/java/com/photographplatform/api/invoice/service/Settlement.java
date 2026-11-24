package com.photographplatform.api.invoice.service;

import com.photographplatform.api.booking.domain.BookingPaymentState;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.util.BusinessZone;
import com.photographplatform.api.invoice.domain.BookingSettlement;
import com.photographplatform.api.invoice.domain.Invoice;
import com.photographplatform.api.invoice.domain.InvoiceSettlement;
import com.photographplatform.api.invoice.repository.InvoiceRepository;
import com.photographplatform.api.payment.service.SucceededPayments;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
 * is Outstanding, when it is due, whether it is Collectable and whether it is
 * Overdue. The one place that works it out
 * (ADR-004 §1). Booking, payment and invoice's own responses ask here; none of
 * them reads invoice or payment rows to decide it for themselves.
 *
 * <p>Money in is settled per booking (ADR-004 §2): a payment on an invoice
 * that was later Storniert counts against the same booking's Live invoices
 * (see {@link #carryOver}). So an invoice's Outstanding amount depends on its
 * booking's other invoices, and even a single invoice is settled together
 * with them.
 *
 * <p>Derived fresh on every call and never stored, so it cannot drift from
 * the rows it is computed from. The rules themselves sit in the two {@code
 * settle} methods, one per invoice and one per booking, and in {@link
 * #carryOver}; a change to what counts as Outstanding or Overdue belongs
 * there, not in a caller.
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

    /** Issue order. The sequence number breaks a tie between two documents issued in the same instant. */
    private static final Comparator<Invoice> OLDEST_FIRST =
        Comparator.comparing(Invoice::getIssuedAt).thenComparing(Invoice::getSequenceNumber);

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
        return withItsBooking(invoice);
    }

    /**
     * One invoice, with its row and its booking's other invoices locked for
     * the rest of the caller's transaction: the serialisation point for
     * everything that collects money against it. Both payment paths are
     * check-then-act on the Outstanding amount returned here ("no open intent,
     * so mint one", "this amount fits, so book it"), and neither conclusion
     * survives a concurrent writer.
     *
     * <p>{@code MANDATORY} because the lock is only worth anything inside the
     * transaction that then writes the payment; outside one it would be
     * released as soon as the query returned.
     *
     * <p>The lock is NOWAIT (see {@code InvoiceRepository#findByIdForPayment}):
     * a second caller is told to retry with a 409 instead of queueing behind
     * someone else's Stripe round-trip.
     *
     * <p>The whole booking is locked because this invoice's Outstanding amount
     * depends on its siblings ({@link #carryOver}). A Storno of a paid sibling
     * turns that sibling's payment into a Carried-over payment, so this
     * invoice's share of it grows. With only this row locked, a Storno landing
     * after the check let the payment through for more than was still owed,
     * and the Customer paid twice. The Storno writes the sibling's row, so the
     * two exclude each other. An invoice without a booking has no siblings and
     * locks only itself.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public InvoiceSettlement lockForPayment(UUID invoiceId) {
        Invoice invoice;
        try {
            invoice = invoiceRepository.findByIdForPayment(invoiceId)
                .orElseThrow(() -> new NotFoundException("Invoice not found: " + invoiceId));
            if (invoice.getBookingId() != null) {
                invoiceRepository.findByBookingIdForPayment(invoice.getBookingId());
            }
        } catch (PessimisticLockingFailureException ex) {
            // Someone else is mid-payment on this invoice or a sibling, or is
            // withdrawing a sibling. Not an error worth a stack trace: by the
            // time the caller looks again the other request has settled, and
            // the amount they would pay may well have changed.
            LOG.info("Invoice {} or a sibling is locked by another operation", invoiceId);
            throw new ConflictException(
                "A payment for this invoice is already being processed. "
                    + "Please reload the page and try again in a moment.");
        }
        return withItsBooking(invoice);
    }

    /**
     * Invoices the caller already holds, each settled with its booking's other
     * invoices, in two queries however many there are. Package-private: only
     * {@code InvoiceService} and {@code SettlementPeriods} have invoice rows in
     * hand to pass.
     *
     * <p>The booking's other invoices are loaded even when the caller passed
     * only Live ones or only one page: a payment on a withdrawn invoice on
     * another page, or from another year, still counts against these.
     */
    Map<UUID, InvoiceSettlement> ofInvoices(List<Invoice> invoices) {
        Map<UUID, Invoice> withSiblings = new LinkedHashMap<>();
        invoices.forEach(inv -> withSiblings.put(inv.getId(), inv));
        List<UUID> bookingIds = invoices.stream()
            .map(Invoice::getBookingId)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
        if (!bookingIds.isEmpty()) {
            invoiceRepository.findByBookingIdInOrderByIssuedAtDesc(bookingIds)
                .forEach(inv -> withSiblings.putIfAbsent(inv.getId(), inv));
        }
        Map<UUID, Long> paidByInvoice = succeededPayments.totalCentsByInvoice(withSiblings.keySet());

        Map<UUID, InvoiceSettlement> settled = new HashMap<>();
        for (List<Invoice> booking : byBooking(withSiblings.values())) {
            CarryOver carried = carryOver(booking, paidByInvoice);
            for (Invoice inv : booking) {
                settled.put(inv.getId(), settle(inv, paidOn(inv, paidByInvoice), carried.into(inv)));
            }
        }
        return invoices.stream().collect(Collectors.toMap(Invoice::getId, inv -> settled.get(inv.getId())));
    }

    private InvoiceSettlement withItsBooking(Invoice invoice) {
        return ofInvoices(List.of(invoice)).get(invoice.getId());
    }

    /**
     * Only a Live invoice owes anything. A Storniert invoice is never paid and
     * its Storno is a correction, not a bill, so neither has an Outstanding
     * amount or a day to pay it by, whatever was paid on them before. The
     * withdrawn invoice used to report its total less its payments, which
     * read as money still owed on a document nobody can pay.
     *
     * <p>A Live invoice owes its total less its own payments and less its
     * share of the booking's Carried-over payments ({@link #carryOver}).
     * {@code paidCents} stays its own payments only: that is the money that
     * arrived against it, and Collected counts those, not the carried-over
     * share, so nothing is Collected twice.
     *
     * <p>The Due date is counted from the day printed on the invoice, not from
     * the UTC instant (see {@link InvoiceDate}), and it is a whole day: Overdue
     * starts the day after it.
     */
    private InvoiceSettlement settle(Invoice invoice, long paidCents, long carriedOverCents) {
        if (!invoice.isLive()) {
            return new InvoiceSettlement(invoice, (int) paidCents, 0, null, false, false);
        }
        int outstanding = (int) Math.max(0, invoice.getTotalCents() - paidCents - carriedOverCents);
        LocalDate dueDate = InvoiceDate.of(invoice.getIssuedAt()).plusDays(DEFAULT_DUE_DAYS);
        boolean collectable = outstanding > 0;
        boolean overdue = collectable && LocalDate.ofInstant(clock.instant(), BusinessZone.ID).isAfter(dueDate);
        return new InvoiceSettlement(invoice, (int) paidCents, outstanding, dueDate, collectable, overdue);
    }

    /**
     * Every invoice's total is summed regardless of status: a Storno's
     * negative total exists to net against the original it withdraws (see
     * {@code InvoiceService#storno}).
     *
     * <p>Credit never changes the state. A booking whose only invoice was
     * Storniert after it was paid stays NOT_INVOICED; the Credit is what says
     * the studio is holding the Customer's money.
     */
    private BookingSettlement settle(List<Invoice> invoices, Map<UUID, Long> paidByInvoice) {
        int invoiced = invoices.stream().mapToInt(Invoice::getTotalCents).sum();
        int paid = invoices.stream()
            .mapToInt(inv -> (int) paidOn(inv, paidByInvoice))
            .sum();
        CarryOver carried = carryOver(invoices, paidByInvoice);
        int credit = carried.creditCents();

        // invoiced <= 0 means every invoice against this booking has been
        // fully storniert. That is "nothing currently owed", the same as never
        // having invoiced — not PAID, which would claim the full quoted total
        // was actually collected.
        if (invoiced <= 0) {
            return new BookingSettlement(BookingPaymentState.NOT_INVOICED, invoiced, paid, credit);
        }
        if (paid >= invoiced) {
            return new BookingSettlement(BookingPaymentState.PAID, invoiced, paid, credit);
        }
        // Overdue is each invoice's own: its own Due date, its own Outstanding.
        // Read across the booking instead, a paid deposit past its Due date made
        // the booking Overdue while the final invoice was still inside its
        // window, and a withdrawn document's old issue date did the same to a
        // corrected booking.
        if (invoices.stream()
            .anyMatch(inv -> settle(inv, paidOn(inv, paidByInvoice), carried.into(inv)).overdue())) {
            return new BookingSettlement(BookingPaymentState.OVERDUE, invoiced, paid, credit);
        }
        BookingPaymentState state = paid <= 0 ? BookingPaymentState.OPEN : BookingPaymentState.PARTIALLY_PAID;
        return new BookingSettlement(state, invoiced, paid, credit);
    }

    /**
     * Money in is settled per booking (ADR-004 §2), so a Customer is never
     * asked to pay twice for one booking. Each Live invoice first takes its
     * own payments. What no invoice claims for itself, a payment on an invoice
     * that was later Storniert (a Carried-over payment) or anything paid on a
     * Live invoice beyond its total, then fills the booking's Live invoices
     * that still owe something, oldest first. What is left after that is
     * Credit.
     *
     * <p>Settled per invoice instead, a Customer who had paid invoice A was
     * asked to pay its replacement B in full once A was Storniert.
     *
     * @param invoices one booking's invoices, every status included
     */
    private static CarryOver carryOver(List<Invoice> invoices, Map<UUID, Long> paidByInvoice) {
        long unclaimed = 0;
        for (Invoice inv : invoices) {
            long paid = paidOn(inv, paidByInvoice);
            unclaimed += inv.isLive() ? Math.max(0, paid - inv.getTotalCents()) : paid;
        }
        Map<UUID, Long> into = new HashMap<>();
        for (Invoice inv : invoices.stream().filter(Invoice::isLive).sorted(OLDEST_FIRST).toList()) {
            long owed = Math.max(0, inv.getTotalCents() - paidOn(inv, paidByInvoice));
            long taken = Math.min(owed, unclaimed);
            into.put(inv.getId(), taken);
            unclaimed -= taken;
        }
        return new CarryOver(into, (int) unclaimed);
    }

    /**
     * Invoices grouped by booking. An invoice with no booking has no other
     * invoice to share money with, so it is settled alone, and money paid on
     * it stays Credit once it is withdrawn.
     */
    private static List<List<Invoice>> byBooking(Collection<Invoice> invoices) {
        Map<UUID, List<Invoice>> byBooking = new LinkedHashMap<>();
        List<List<Invoice>> groups = new ArrayList<>();
        for (Invoice inv : invoices) {
            if (inv.getBookingId() == null) {
                groups.add(List.of(inv));
            } else {
                byBooking.computeIfAbsent(inv.getBookingId(), id -> new ArrayList<>()).add(inv);
            }
        }
        groups.addAll(byBooking.values());
        return groups;
    }

    private static long paidOn(Invoice invoice, Map<UUID, Long> paidByInvoice) {
        return paidByInvoice.getOrDefault(invoice.getId(), 0L);
    }

    private static List<UUID> ids(List<Invoice> invoices) {
        return invoices.stream().map(Invoice::getId).toList();
    }

    /**
     * Where one booking's unclaimed money went.
     *
     * @param intoInvoice how much of it each Live invoice took
     * @param creditCents what no Live invoice needed: Credit
     */
    private record CarryOver(Map<UUID, Long> intoInvoice, int creditCents) {

        long into(Invoice invoice) {
            return intoInvoice.getOrDefault(invoice.getId(), 0L);
        }
    }
}
