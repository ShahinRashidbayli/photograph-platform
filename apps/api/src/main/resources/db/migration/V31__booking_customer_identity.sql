-- Who a booking belongs to, as an identity rather than as an address.
--
-- Three places decide whether a signed-in customer may see a booking, an
-- invoice or a payment, and all three ask the same question: does
-- bookings.client_email match the email on their user row.
--
--   BookingQueryService#getOwnBookings
--   InvoiceService#listForCustomer
--   PaymentService#requireOwnedByCallerIfCustomer
--
-- That makes a contact detail into an authorization key, with two consequences.
-- A customer who changes their address loses every booking they have. And the
-- photographer's edit form writes client_email freely, so editing one field
-- moves a booking — and the invoices and payments hanging off it — to whoever
-- owns the new address, recorded in the audit trail as an unremarkable
-- BOOKING_UPDATED.
--
-- The other candidate, bookings.client_id, cannot carry this. It points at
-- `clients`, the photographer's own address book, which nothing in the
-- application writes yet and which is not where a customer's login lives. A
-- customer is a `users` row with staff_role IS NULL, so that is what a booking
-- has to name.
ALTER TABLE bookings ADD COLUMN customer_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

-- The direction the three ownership queries read it.
CREATE INDEX idx_bookings_customer_user ON bookings (customer_user_id);

-- Backfill what the email match would already have resolved, so no customer
-- loses sight of a booking they can see today. uq_users_tenant_email (V2)
-- makes this at most one user per booking; staff_role IS NULL keeps it to
-- customer accounts, since a photographer who is also somebody else's client
-- has two rows and only one of them is the client.
UPDATE bookings b
SET customer_user_id = u.id
FROM users u
WHERE u.tenant_id = b.tenant_id
  AND u.staff_role IS NULL
  AND lower(u.email) = lower(b.client_email);

-- Deliberately nullable, and no NOT NULL to come. A booking may exist before
-- its customer has an account at all — the photographer takes it over the
-- phone and types the address in — and inventing an identity for that would be
-- worse than admitting there isn't one. Those rows keep falling back to the
-- email match until someone signs up, which is what the services do; once the
-- link exists, editing client_email no longer moves anything.
