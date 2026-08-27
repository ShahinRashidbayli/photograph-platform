-- Which photographer is shooting this booking.
--
-- Seats let a studio hold three photographers (V25) and then recorded nothing
-- about who does what. Three people could take the same Saturday, the schedule
-- read the same for everyone, and the reports could not answer "who brought
-- this in" — the question a studio owner asks first.
--
-- Nullable, and stays nullable. A booking arrives from an enquiry before
-- anyone has decided who is shooting it, and forcing a name at that moment
-- would mean picking one arbitrarily — which is worse than an empty field,
-- because an arbitrary answer looks like a decision.
ALTER TABLE bookings ADD COLUMN assigned_user_id UUID;

-- ON DELETE SET NULL, never CASCADE. A booking belongs to the studio, not to
-- the account that happened to be assigned: removing a photographer — or a
-- photographer leaving of their own accord (V25's leaveStudio) — must not take
-- the studio's bookings, its invoices or its client history with them.
--
-- The booking then reads as unassigned, which is true: nobody is shooting it
-- until somebody else is.
ALTER TABLE bookings
    ADD CONSTRAINT fk_bookings_assigned_user FOREIGN KEY (assigned_user_id)
    REFERENCES users (id) ON DELETE SET NULL;

-- The two questions this column exists to answer: "what am I shooting" (one
-- photographer, ordered by date) and "who is shooting what" (a studio's
-- calendar). Partial, because unassigned rows are found by the tenant-wide
-- index that already exists and would only bloat this one.
CREATE INDEX idx_bookings_assigned
    ON bookings (tenant_id, assigned_user_id, event_date)
    WHERE assigned_user_id IS NOT NULL;

-- No backfill. Every booking that exists today was taken by a studio with one
-- photographer in it, so assigning them all to that person would be *probably*
-- right — and a report built on "probably" is worse than one that says the old
-- bookings predate the question.
