-- The customer-bookings endpoint looks up a customer's own bookings by email
-- via findByClientEmailIgnoreCase*, which Hibernate renders as
-- `upper(client_email) = upper(?)`. A plain btree index on client_email would
-- NOT be used for that predicate, so the index has to match the expression.
CREATE INDEX IF NOT EXISTS idx_bookings_client_email_upper
    ON bookings (upper(client_email));

-- Leads are listed and CSV-exported newest-first (ORDER BY created_at DESC).
-- The table only indexes score/status, so ordering falls back to a full sort.
CREATE INDEX IF NOT EXISTS idx_leads_created_at
    ON leads (created_at DESC);
