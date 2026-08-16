-- F6: payments against an invoice — Stripe Card/SEPA and manual Überweisung.
-- See PaymentService for the numbering-independent flow: unlike invoices,
-- payments aren't GoBD-immutable documents themselves (an invoice is the
-- legal record; a payment row is operational state tracking whether it's
-- been collected), so no immutability trigger here — a failed Stripe
-- attempt legitimately transitions PENDING -> FAILED, and a webhook retry
-- must be able to update the same row idempotently.

CREATE TABLE payments (
    id                        UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id                 UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    invoice_id                UUID         NOT NULL REFERENCES invoices (id),
    method                    VARCHAR(20)  NOT NULL,
    status                    VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    amount_cents              INTEGER      NOT NULL,
    currency                  VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    stripe_payment_intent_id  VARCHAR(255),
    confirmed_by_user_id      UUID,
    confirmed_at              TIMESTAMPTZ,
    created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_payments            PRIMARY KEY (id),
    CONSTRAINT uq_payments_intent     UNIQUE (stripe_payment_intent_id),
    CONSTRAINT chk_payments_method    CHECK (method IN ('CARD', 'SEPA', 'UEBERWEISUNG')),
    CONSTRAINT chk_payments_status    CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED'))
);

CREATE INDEX idx_payments_tenant_id  ON payments (tenant_id);
CREATE INDEX idx_payments_invoice_id ON payments (invoice_id);

-- Stripe webhook idempotency ledger. Deliberately has no tenant_id: the
-- webhook is a public endpoint that hasn't resolved a tenant at the point
-- this check runs (that's the whole reason it's needed — to safely re-derive
-- tenant/invoice from event metadata without double-applying a retried
-- delivery), and it holds nothing but an opaque Stripe event id, no PII.
CREATE TABLE processed_stripe_events (
    stripe_event_id VARCHAR(255) NOT NULL,
    processed_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_processed_stripe_events PRIMARY KEY (stripe_event_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON payments, processed_stripe_events TO fotolio_app;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY payments_tenant_isolation ON payments
    FOR ALL TO fotolio_app
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
