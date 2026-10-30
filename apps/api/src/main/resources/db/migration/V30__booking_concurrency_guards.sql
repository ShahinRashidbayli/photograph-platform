-- Concurrency guards on the booking lifecycle, in the spirit of V18.
--
-- V18 closed the same hole on the money path: read the invoice, decide from
-- what it says, write. Nothing serialised that window, so two interleaved
-- requests both passed a check only one of them should have. The booking
-- lifecycle has the identical shape in four places, and two of them create
-- rows rather than just flipping a column:
--
--   BookingService#changeStatus       -- last writer wins; a CONFIRMED and a
--                                        CANCELLED landing together leave one
--                                        silently overwritten and the state
--                                        machine none the wiser.
--   LeadService#rejectLead/#markReplied  -- same, one column.
--   LeadConversionService#convertLead -- both callers see a non-BOOKED lead,
--                                        both convert: TWO bookings from one
--                                        lead. Its javadoc promises the
--                                        opposite.
--   InquiryRequestService#updateStatus - both callers see PENDING, both
--                                        accept: TWO bookings and TWO
--                                        "your inquiry was accepted" emails
--                                        from one inquiry.
--
-- Two layers, because they answer different questions.

-- ── 1. Optimistic locking ────────────────────────────────────────────────────
-- Answers "did anyone else change this row since I read it". @Version on the
-- entity turns the check-then-act into a conditional UPDATE ... WHERE version =
-- ?, and a lost update surfaces as OptimisticLockingFailureException -> 409
-- rather than as silence. Chosen over V18's pessimistic lock because nothing
-- here makes a network call while holding the row, so there is no reason to
-- pay for a lock and every reason to prefer the cheaper detect-and-retry.
--
-- DEFAULT 0 so existing rows are valid immediately; Hibernate takes over the
-- increment from the first write onwards.
ALTER TABLE bookings         ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE leads            ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE inquiry_requests ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

-- ── 2. Uniqueness on the funnel links ────────────────────────────────────────
-- Answers "can this lead/inquiry ever have produced two bookings" — and the
-- answer must be no regardless of which future caller remembers the status
-- check. Same reasoning as V18's uq_payments_one_pending_per_invoice: the
-- application-level exclusion is the fix, the index is the backstop.
--
-- Partial, because the columns are null for a manually created booking and
-- several of those per tenant is the normal case.

-- Any duplicate predating the constraint would fail the index build and stop
-- the deploy. Drop the *back-link* on the newer duplicate rather than the
-- booking: the booking is real work with invoices possibly attached to it, and
-- deleting it to satisfy a constraint would destroy more than the constraint
-- protects. What was actually wrong is the second row's claim to have come
-- from that lead/inquiry, so that is what is cleared. The oldest link, which
-- is the one the funnel report already counted, survives.
UPDATE bookings b
SET lead_id = NULL
WHERE b.lead_id IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM bookings older
      WHERE older.lead_id = b.lead_id
        AND (older.created_at, older.id) < (b.created_at, b.id)
  );

UPDATE bookings b
SET inquiry_id = NULL
WHERE b.inquiry_id IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM bookings older
      WHERE older.inquiry_id = b.inquiry_id
        AND (older.created_at, older.id) < (b.created_at, b.id)
  );

CREATE UNIQUE INDEX uq_bookings_one_per_lead
    ON bookings (lead_id)
    WHERE lead_id IS NOT NULL;

CREATE UNIQUE INDEX uq_bookings_one_per_inquiry
    ON bookings (inquiry_id)
    WHERE inquiry_id IS NOT NULL;
