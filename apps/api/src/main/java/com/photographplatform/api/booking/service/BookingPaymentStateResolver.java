package com.photographplatform.api.booking.service;

import com.photographplatform.api.booking.domain.BookingPaymentState;
import com.photographplatform.api.invoice.domain.Invoice;
import com.photographplatform.api.invoice.domain.InvoiceStatus;
import com.photographplatform.api.invoice.repository.InvoiceRepository;
import com.photographplatform.api.payment.repository.PaymentRepository;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Computes a booking's payment progress from its real {@code Invoice}/{@code
 * Payment} rows. Never stored — always derived fresh, so it can never drift
 * out of sync the way a manually-set lifecycle state could.
 *
 * <p>A booking can have more than one invoice (an original plus a Storno
 * correction, or separate deposit/final invoices) — every invoice's {@code
 * total_cents} is summed regardless of {@code status}, since a Storno's
 * negative total is specifically designed to net against the original it
 * corrects (see {@code InvoiceService#storno}).
 */
@Component
public class BookingPaymentStateResolver {

    /**
     * No explicit payment-terms tracking yet (spec's EN 16931 field exists,
     * but nothing sets it) — net-14 is the assumed default due date.
     */
    private static final int DEFAULT_DUE_DAYS = 14;

    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;

    public BookingPaymentStateResolver(InvoiceRepository invoiceRepository, PaymentRepository paymentRepository) {
        this.invoiceRepository = invoiceRepository;
        this.paymentRepository = paymentRepository;
    }

    public record Summary(BookingPaymentState state, int invoicedCents, int paidCents) {
    }

    /**
     * Single-booking form. Delegates to {@link #resolveAll} rather than
     * keeping its own loop: the previous implementation summed payments with
     * one {@code sumSucceededAmountCents} call per invoice, so a booking with
     * an original plus a Storno correction cost three queries instead of two —
     * a small N+1, but on the write paths ({@code createBooking},
     * {@code updateBooking}, {@code changeStatus}) that all map their result
     * through here.
     */
    public Summary resolve(UUID bookingId) {
        return resolveAll(List.of(bookingId))
            .getOrDefault(bookingId, new Summary(BookingPaymentState.NOT_INVOICED, 0, 0));
    }

    /**
     * Batch form of {@link #resolve(UUID)} for a whole page of bookings —
     * two queries total (all invoices for the given bookings, then all
     * succeeded payment sums for those invoices' ids) instead of resolving
     * each booking's payment state with its own pair of queries. Used by
     * {@code BookingService#listForPhotographer} and {@code #getOwnBookings},
     * which previously called {@link #resolve(UUID)} once per row in the
     * page — an N+1 that showed up as 1-2 extra queries per booking.
     */
    public Map<UUID, Summary> resolveAll(Collection<UUID> bookingIds) {
        if (bookingIds.isEmpty()) {
            return Map.of();
        }
        List<Invoice> invoices = invoiceRepository.findByBookingIdInOrderByIssuedAtDesc(bookingIds);
        Map<UUID, List<Invoice>> invoicesByBooking = invoices.stream()
            .collect(Collectors.groupingBy(Invoice::getBookingId));

        Map<UUID, Long> paidByInvoiceId = invoices.isEmpty()
            ? Map.of()
            : paymentRepository
                .sumSucceededAmountCentsGroupedByInvoiceId(invoices.stream().map(Invoice::getId).toList())
                .stream()
                .collect(Collectors.toMap(
                    PaymentRepository.SucceededSum::getInvoiceId, PaymentRepository.SucceededSum::getTotal));

        Map<UUID, Summary> result = new HashMap<>();
        for (UUID bookingId : bookingIds) {
            List<Invoice> bookingInvoices = invoicesByBooking.get(bookingId);
            if (bookingInvoices == null || bookingInvoices.isEmpty()) {
                result.put(bookingId, new Summary(BookingPaymentState.NOT_INVOICED, 0, 0));
                continue;
            }
            int paid = bookingInvoices.stream()
                .mapToInt(inv -> paidByInvoiceId.getOrDefault(inv.getId(), 0L).intValue())
                .sum();
            result.put(bookingId, summarize(bookingInvoices, paid));
        }
        return result;
    }

    private Summary summarize(List<Invoice> invoices, int paid) {
        int invoiced = invoices.stream().mapToInt(Invoice::getTotalCents).sum();

        // invoiced <= 0 means every invoice against this booking has been
        // fully storno'd — the negative correction nets the original back to
        // zero (see class javadoc). That's "nothing currently owed", the same
        // as never having invoiced at all — not PAID, which would claim the
        // full quoted total was actually collected.
        if (invoiced <= 0) {
            return new Summary(BookingPaymentState.NOT_INVOICED, invoiced, paid);
        }
        if (paid >= invoiced) {
            return new Summary(BookingPaymentState.PAID, invoiced, paid);
        }
        boolean overdue = invoices.stream()
            .filter(inv -> inv.getStatus() != InvoiceStatus.STORNIERT && inv.getStornoOfId() == null)
            .anyMatch(this::isPastDue);
        BookingPaymentState state = paid <= 0
            ? (overdue ? BookingPaymentState.OVERDUE : BookingPaymentState.OPEN)
            : (overdue ? BookingPaymentState.OVERDUE : BookingPaymentState.PARTIALLY_PAID);
        return new Summary(state, invoiced, paid);
    }

    /**
     * Only live invoices can be overdue. A withdrawn invoice and its Storno
     * both keep their original {@code issued_at}, so counting them meant a
     * booking that was corrected and re-invoiced showed OVERDUE from the
     * cancelled document's date — while the replacement was still well inside
     * its own payment window.
     */
    private boolean isPastDue(Invoice invoice) {
        return invoice.getIssuedAt().plusDays(DEFAULT_DUE_DAYS).isBefore(OffsetDateTime.now());
    }
}
