-- Contracts with a simple electronic signature (Capability.CONTRACTS, Pro).
--
-- "Simple electronic signature" is eIDAS Art. 3(10): data in electronic form
-- attached to other data which the signatory uses to sign. A photography
-- contract carries no statutory form requirement (§126 BGB Schriftform is not
-- prescribed for it), so a typed name plus recorded consent is binding in
-- Germany. What makes it *provable* is not the signature field but the
-- evidence stored beside it — who signed, when, from where, and over exactly
-- which text. Hence the signer_* columns and body_sha256 below.
--
-- See ContractService for the lifecycle these columns support.

CREATE TABLE contracts (
    id             UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id      UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    booking_id     UUID         NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,

    status         VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    title          VARCHAR(200) NOT NULL,
    body           TEXT         NOT NULL,

    -- The recipient is copied in rather than read through the booking at send
    -- time. A booking's contact email can be corrected afterwards; the contract
    -- must keep saying who it was actually sent to, or the audit trail drifts
    -- away from what happened.
    recipient_name  VARCHAR(200) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,

    -- The photographer's statutory identity, frozen at send time from the
    -- tenant's legal details (V33). Same reason: a contract states who the
    -- parties were on the day it was signed, and Settings can change tomorrow.
    issuer_name        VARCHAR(200),
    issuer_address     VARCHAR(500),
    issuer_email       VARCHAR(255),

    -- SHA-256 of `body` at the moment of signing. The evidence that the text
    -- being displayed today is the text that was agreed to: re-hash the body
    -- and compare. Null until signed.
    body_sha256    CHAR(64),

    -- Signature evidence. All null until signed, all set together.
    signer_name       VARCHAR(200),
    signer_user_id    UUID REFERENCES users (id) ON DELETE SET NULL,
    signer_ip         VARCHAR(64),
    signer_user_agent VARCHAR(500),
    signed_at         TIMESTAMPTZ,

    sent_at        TIMESTAMPTZ,
    cancelled_at   TIMESTAMPTZ,

    -- Optimistic lock, for the same reason bookings have one (V30): signing is
    -- a check-then-act over status, and two concurrent submits must not both
    -- pass the "is it still SENT?" test.
    version        BIGINT       NOT NULL DEFAULT 0,

    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_contracts PRIMARY KEY (id),
    CONSTRAINT ck_contracts_status
        CHECK (status IN ('DRAFT', 'SENT', 'SIGNED', 'CANCELLED')),

    -- A signed contract without its evidence would be a signature nobody can
    -- stand behind; the database refuses to hold one rather than trusting every
    -- future write path to remember.
    CONSTRAINT ck_contracts_signed_evidence CHECK (
        status <> 'SIGNED' OR (
            signed_at IS NOT NULL
            AND signer_name IS NOT NULL
            AND body_sha256 IS NOT NULL
        )
    ),
    CONSTRAINT ck_contracts_sent_at CHECK (status = 'DRAFT' OR sent_at IS NOT NULL)
);

-- The photographer's list view: their contracts, newest first.
CREATE INDEX idx_contracts_tenant_created ON contracts (tenant_id, created_at DESC);

-- The booking detail panel, and the "does this booking already have one?" check.
CREATE INDEX idx_contracts_booking ON contracts (booking_id);

-- The customer portal lists by recipient email, because a booking taken over
-- the phone has a contract before its customer has an account (the same reason
-- bookings.customer_user_id is nullable — see V31).
CREATE INDEX idx_contracts_recipient_email ON contracts (LOWER(recipient_email));
