-- Where a euro came from, recorded before there is more than one answer.
--
-- Every invoice and payment today is a client paying their photographer. From
-- studio rental onward (docs/adr/003-community-cross-tenant-data.md §6) money
-- also moves photographer → photographer, which is a different business: the
-- counterparty is a business rather than a consumer, the VAT treatment differs,
-- and the platform fee is taken for a different reason than the Starter
-- commission.
--
-- AnalyticsService sums issued invoices into one figure called "revenue". With
-- two sources and no column, that figure answers neither question — and the
-- rows that could have distinguished them would already be written. Adding the
-- column now costs a DEFAULT; adding it later costs a migration over data that
-- no longer knows the answer.
--
-- Nothing reads it yet. It is written at every creation site so the day the
-- second value appears, the first one is already true everywhere.

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'CLIENT_BOOKING';

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'CLIENT_BOOKING';

-- The allowed set, in the database as well as in the enum. A CHECK rather than
-- a lookup table for the same reason the status columns use one: the values are
-- a closed set that changes with the code, not data anyone administers.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invoices_source_check'
    ) THEN
        ALTER TABLE invoices
            ADD CONSTRAINT invoices_source_check
            CHECK (source IN ('CLIENT_BOOKING', 'MARKETPLACE'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_source_check'
    ) THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_source_check
            CHECK (source IN ('CLIENT_BOOKING', 'MARKETPLACE'));
    END IF;
END
$$;

-- No index. Every row holds the same value today, so one would be ignored by
-- the planner and misread by the next person as evidence that something filters
-- on it. The index belongs with the first query that actually splits the two —
-- see V16 for how the invoice access paths are chosen.
