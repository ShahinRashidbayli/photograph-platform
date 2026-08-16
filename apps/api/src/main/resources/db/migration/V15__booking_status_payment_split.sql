-- Payment progress used to be conflated into the booking lifecycle
-- (DEPOSIT_PAID/FULLY_PAID as states). It's now derived at read time from
-- real invoices/payments (see BookingPaymentStateResolver) — this migration
-- only touches the lifecycle column: drops the two payment-shaped states,
-- adds POSTPONED and DECLINED (the gaps the spec's own review flagged: no
-- way to represent a postponed shoot, and rejection was folded into
-- CANCELLED).
--
-- Remap existing rows before tightening the constraint — DEPOSIT_PAID and
-- FULLY_PAID both mean "the shoot proceeded", i.e. CONFIRMED in the new
-- lifecycle-only model; whether it was paid is now answered by querying
-- invoices/payments instead of the status column.
UPDATE bookings SET status = 'CONFIRMED' WHERE status IN ('DEPOSIT_PAID', 'FULLY_PAID');

ALTER TABLE bookings DROP CONSTRAINT chk_booking_status;
ALTER TABLE bookings ADD CONSTRAINT chk_booking_status CHECK (
    status IN ('ENQUIRY', 'CONFIRMED', 'POSTPONED', 'COMPLETED', 'DECLINED', 'CANCELLED')
);
