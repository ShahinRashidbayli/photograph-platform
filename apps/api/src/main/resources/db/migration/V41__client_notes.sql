-- The client directory is derived from bookings; only the notes are its own.
--
-- `clients` (V11) was meant to be the directory, but nothing in the
-- application ever wrote a row to it: only the demo seed did. Every real
-- studio therefore saw an empty /clients page while its bookings held a dozen
-- people. Its counters (total_bookings, total_spent_cents, last_booking_date)
-- were never maintained either.
--
-- The directory is now a live grouping of the studio's bookings by
-- lower(client_email), the same identity V38 already uses to sign a customer
-- in. Every figure on it is computed at read time, so there is nothing to
-- backfill and nothing to drift when a booking is edited or cancelled. The one
-- thing a photographer writes about a client, their private notes, has no
-- booking to live on, so it gets this table, keyed by the same normalised
-- address. A row exists only once somebody writes a note.
CREATE TABLE client_notes (
    id         UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id  UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    -- Trimmed and lower-cased, as bookings.client_email is written
    -- (Normalize.email), so "Maria@X.de" and "maria@x.de" are one client.
    email      VARCHAR(320) NOT NULL,
    notes      TEXT         NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_client_notes        PRIMARY KEY (id),
    CONSTRAINT uq_client_notes_email  UNIQUE (tenant_id, email),
    CONSTRAINT chk_client_notes_email CHECK (email = lower(btrim(email)))
);

-- Carry over the notes written on the old directory. Where one address had
-- several rows (only possible by case), the newest note wins.
INSERT INTO client_notes (tenant_id, email, notes)
SELECT DISTINCT ON (c.tenant_id, lower(btrim(c.email)))
       c.tenant_id, lower(btrim(c.email)), btrim(c.notes)
FROM clients c
WHERE c.notes IS NOT NULL AND btrim(c.notes) <> ''
ORDER BY c.tenant_id, lower(btrim(c.email)), c.created_at DESC;

-- Same grant and isolation as V36: without the grant the first authenticated
-- read fails at runtime, and the policy is the backstop for a query that
-- forgets its tenant.
GRANT SELECT, INSERT, UPDATE, DELETE ON client_notes TO fotolio_app;

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY client_notes_tenant_isolation ON client_notes
    FOR ALL TO fotolio_app
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- The directory groups on this expression; V11's index is on upper().
CREATE INDEX idx_bookings_client_email_lower ON bookings (tenant_id, lower(btrim(client_email)));

COMMENT ON TABLE clients IS
    'Deprecated (V41): nothing reads it for the directory any more, which is '
    'derived from bookings; notes moved to client_notes. Kept only until '
    'bookings.client_id and CreateBookingRequest.clientId are removed.';
