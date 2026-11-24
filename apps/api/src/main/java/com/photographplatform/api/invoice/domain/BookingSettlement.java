package com.photographplatform.api.invoice.domain;

import com.photographplatform.api.booking.domain.BookingPaymentState;

/**
 * Where all invoices of one booking stand, as {@code Settlement#ofBookings}
 * derives it. Never stored.
 *
 * @param invoicedCents the sum of every invoice's total, Storno included, so a
 *     fully storniert booking nets to zero
 * @param paidCents the sum of every succeeded payment on those invoices
 * @param creditCents Credit: what was paid beyond what the booking's Live
 *     invoices ask for, such as a payment on an invoice that was Storniert
 *     with no replacement. The studio holds it until a new invoice uses it or
 *     it is paid back; it never changes {@code state}
 */
public record BookingSettlement(BookingPaymentState state, int invoicedCents, int paidCents, int creditCents) {

    /**
     * A booking with nothing invoiced against it. What callers fall back to
     * rather than risking a null reaching {@code state()}.
     */
    public static BookingSettlement none() {
        return new BookingSettlement(BookingPaymentState.NOT_INVOICED, 0, 0, 0);
    }
}
