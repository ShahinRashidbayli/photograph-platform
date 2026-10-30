package com.photographplatform.api.booking.domain;

/**
 * A booking's payment progress — always computed from real {@code Invoice}
 * and {@code Payment} rows (see {@code BookingPaymentStateResolver}), never
 * stored. Independent of {@link BookingStatus}: a booking can be {@code
 * CONFIRMED} and {@code OVERDUE} at the same time, which the old conflated
 * model (payment as a lifecycle state) couldn't represent at all.
 */
public enum BookingPaymentState {
    /** No invoice has been issued against this booking yet. */
    NOT_INVOICED,
    /** Invoiced, nothing collected yet, due date not passed. */
    OPEN,
    /** Some but not all of the invoiced total has been collected. */
    PARTIALLY_PAID,
    /** The invoiced total has been fully collected. */
    PAID,
    /** Invoiced, not fully paid, and past the payment due date. */
    OVERDUE
}
