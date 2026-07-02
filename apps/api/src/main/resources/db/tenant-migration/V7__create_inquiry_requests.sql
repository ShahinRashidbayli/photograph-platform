-- InquiryRequest is the authenticated-customer counterpart to the anonymous
-- Lead. A customer arrives via the photographer's bio link, logs in with a
-- magic link, and submits this form. customer_id is a UUID reference to
-- public.users — no FK constraint because this is a tenant-schema table and
-- cross-schema FKs in PostgreSQL are not supported.

CREATE TABLE IF NOT EXISTS inquiry_requests (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    customer_id   UUID         NOT NULL,
    event_type    VARCHAR(20)  NOT NULL,
    budget_range  VARCHAR(20)  NOT NULL,
    proposed_date DATE         NOT NULL,
    location      VARCHAR(200),
    message       TEXT,
    score         VARCHAR(10)  NOT NULL DEFAULT 'MED',
    status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    source        VARCHAR(30)  NOT NULL DEFAULT 'BIO_LINK',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_inquiry_requests PRIMARY KEY (id),
    CONSTRAINT chk_inquiry_score  CHECK (score  IN ('HIGH', 'MED', 'LOW')),
    CONSTRAINT chk_inquiry_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'BOOKING_CREATED'))
);

CREATE INDEX IF NOT EXISTS idx_inquiry_requests_status     ON inquiry_requests (status);
CREATE INDEX IF NOT EXISTS idx_inquiry_requests_created_at ON inquiry_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiry_requests_customer   ON inquiry_requests (customer_id);
