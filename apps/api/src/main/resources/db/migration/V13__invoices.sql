-- F5: German invoicing — GoBD immutability, §19/§14 UStG tax modes, DATEV-ready
-- line items. See InvoiceService for the numbering/issuance/storno logic this
-- schema supports.

-- ─────────────────────────────────────────
--  INVOICE COUNTERS
-- ─────────────────────────────────────────
-- One row per (tenant, year). Numbers are handed out via a single atomic
-- upsert (see InvoiceNumberRepository) — INSERT..ON CONFLICT DO UPDATE takes
-- a row lock and serializes concurrent callers, so two invoices can never be
-- issued the same number even under concurrent requests. A plain
-- MAX(invoice_number)+1 read-then-write would race.
CREATE TABLE invoice_counters (
    tenant_id    UUID    NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    issue_year   INTEGER NOT NULL,
    next_number  INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT pk_invoice_counters PRIMARY KEY (tenant_id, issue_year)
);

-- ─────────────────────────────────────────
--  INVOICES
-- ─────────────────────────────────────────
CREATE TABLE invoices (
    id               UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id        UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    booking_id       UUID         REFERENCES bookings (id) ON DELETE SET NULL,
    invoice_number   VARCHAR(20)  NOT NULL,
    issue_year       INTEGER      NOT NULL,
    sequence_number  INTEGER      NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'ISSUED',
    tax_mode         VARCHAR(20)  NOT NULL,

    -- Issuer snapshot at time of issuance — a later edit to the tenant's
    -- business profile must not retroactively change an already-issued
    -- invoice's legally-required issuer details.
    issuer_business_name VARCHAR(200) NOT NULL,
    issuer_address_line1 VARCHAR(200) NOT NULL,
    issuer_address_line2 VARCHAR(200),
    issuer_postal_code   VARCHAR(20)  NOT NULL,
    issuer_city          VARCHAR(100) NOT NULL,
    issuer_country       VARCHAR(2)   NOT NULL,
    issuer_tax_id        VARCHAR(50),
    issuer_vat_id        VARCHAR(50),

    -- Buyer snapshot — same reasoning, plus the buyer may not even be a
    -- platform user (no account exists to join against later).
    buyer_name          VARCHAR(200) NOT NULL,
    buyer_email          VARCHAR(320) NOT NULL,
    buyer_address_line1  VARCHAR(200),
    buyer_address_line2  VARCHAR(200),
    buyer_postal_code    VARCHAR(20),
    buyer_city           VARCHAR(100),
    buyer_country        VARCHAR(2),

    -- EN 16931 readiness (spec §10.4) — not emitted as ZUGFeRD XML yet, but
    -- the fields exist so that generator can be added later without another
    -- migration touching every invoice row.
    buyer_reference  VARCHAR(100),
    payment_terms    VARCHAR(200),

    currency         VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    subtotal_cents   INTEGER      NOT NULL,
    tax_cents        INTEGER      NOT NULL DEFAULT 0,
    total_cents      INTEGER      NOT NULL,

    storno_of_id     UUID         REFERENCES invoices (id),

    pdf_r2_key       VARCHAR(500),
    pdf_sha256       CHAR(64),

    issued_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_invoices           PRIMARY KEY (id),
    CONSTRAINT uq_invoices_number    UNIQUE (tenant_id, issue_year, sequence_number),
    CONSTRAINT chk_invoices_status   CHECK (status IN ('ISSUED', 'STORNIERT')),
    CONSTRAINT chk_invoices_tax_mode CHECK (tax_mode IN ('KLEINUNTERNEHMER', 'REGELBESTEUERUNG'))
);

CREATE INDEX idx_invoices_tenant_id  ON invoices (tenant_id);
CREATE INDEX idx_invoices_booking_id ON invoices (booking_id);

-- ─────────────────────────────────────────
--  INVOICE LINE ITEMS
-- ─────────────────────────────────────────
CREATE TABLE invoice_line_items (
    id                UUID          NOT NULL DEFAULT gen_random_uuid(),
    -- Duplicated from invoices.tenant_id (not just inferred by joining
    -- through invoice_id) so RLS can enforce isolation directly on this
    -- table too — same defense-in-depth pattern as delivery_photos/galleries
    -- in V11. Without it, RLS on `invoices` alone would not stop a query
    -- that reads invoice_line_items directly by a guessed invoice_id.
    tenant_id         UUID          NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    invoice_id        UUID          NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    description       VARCHAR(300)  NOT NULL,
    quantity          NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price_cents  INTEGER       NOT NULL,
    tax_category      VARCHAR(20)   NOT NULL DEFAULT 'STANDARD',
    tax_rate_percent  NUMERIC(4,2)  NOT NULL DEFAULT 0,
    line_total_cents  INTEGER       NOT NULL,
    sort_order        INTEGER       NOT NULL DEFAULT 0,

    CONSTRAINT pk_invoice_line_items      PRIMARY KEY (id),
    CONSTRAINT chk_line_items_tax_category CHECK (tax_category IN ('STANDARD', 'REDUCED', 'EXEMPT'))
);

CREATE INDEX idx_invoice_line_items_tenant_id  ON invoice_line_items (tenant_id);
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items (invoice_id);

-- ─────────────────────────────────────────
--  GoBD immutability
-- ─────────────────────────────────────────
-- Once issued, an invoice's only legal mutation is the single transition
-- ISSUED -> STORNIERT (recorded, never deleted). Every other field — amounts,
-- numbering, issuer/buyer snapshot, PDF reference — is frozen at insert time.
CREATE OR REPLACE FUNCTION invoices_immutability() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'invoices are immutable (GoBD): delete is not permitted, issue a Storno instead';
    END IF;
    IF OLD.status = 'STORNIERT' THEN
        RAISE EXCEPTION 'invoice % is already storniert and cannot be modified further', OLD.invoice_number;
    END IF;
    IF NEW.status IS DISTINCT FROM 'STORNIERT' THEN
        RAISE EXCEPTION 'invoices are immutable (GoBD): the only permitted change is status ISSUED -> STORNIERT';
    END IF;
    IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
        RAISE EXCEPTION 'invoices are immutable (GoBD): only the status column may change';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoices_immutable
    BEFORE UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION invoices_immutability();

CREATE OR REPLACE FUNCTION invoice_line_items_immutability() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'invoice line items are immutable (GoBD): correct via a new Storno invoice, not by editing this row';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_line_items_immutable
    BEFORE UPDATE OR DELETE ON invoice_line_items
    FOR EACH ROW EXECUTE FUNCTION invoice_line_items_immutability();

-- ─────────────────────────────────────────
--  Grants + RLS
-- ─────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON invoices, invoice_line_items, invoice_counters TO fotolio_app;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['invoices', 'invoice_line_items', 'invoice_counters']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
        EXECUTE format(
            'CREATE POLICY %I ON %I ' ||
            'FOR ALL TO fotolio_app ' ||
            'USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) ' ||
            'WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
            tbl || '_tenant_isolation', tbl
        );
    END LOOP;
END
$$;
