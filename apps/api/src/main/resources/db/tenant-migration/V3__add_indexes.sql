-- BookingController.customerBookings filters bookings.client_id but the table
-- only indexes (event_date, status). At >100 bookings per tenant this becomes
-- a sequential scan.
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings (client_id);
