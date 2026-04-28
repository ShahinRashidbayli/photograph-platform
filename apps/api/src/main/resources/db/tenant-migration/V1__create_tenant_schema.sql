-- ─────────────────────────────────────────
--  PHOTOS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photos (
    id             UUID         NOT NULL DEFAULT gen_random_uuid(),
    category_id    UUID,
    r2_key         VARCHAR(500) NOT NULL,
    thumbnail_key  VARCHAR(500),
    file_size_bytes BIGINT,
    width          INTEGER,
    height         INTEGER,
    sort_order     INTEGER      NOT NULL DEFAULT 0,
    is_published   BOOLEAN      NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_photos PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_photos_sort ON photos (sort_order);

-- ─────────────────────────────────────────
--  CATEGORIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id         UUID         NOT NULL DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    sort_order INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT pk_categories PRIMARY KEY (id)
);

-- ─────────────────────────────────────────
--  CLIENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
    id                 UUID         NOT NULL DEFAULT gen_random_uuid(),
    email              VARCHAR(320) NOT NULL,
    full_name          VARCHAR(200) NOT NULL,
    phone              VARCHAR(30),
    notes              TEXT,
    tags               TEXT[],
    source             VARCHAR(30),
    total_bookings     INTEGER      NOT NULL DEFAULT 0,
    total_spent_cents  INTEGER      NOT NULL DEFAULT 0,
    last_booking_date  DATE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_clients     PRIMARY KEY (id),
    CONSTRAINT uq_client_email UNIQUE (email)
);

-- ─────────────────────────────────────────
--  PACKAGES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
    id              UUID         NOT NULL DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    price_cents     INTEGER      NOT NULL,
    currency        VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    duration_hours  NUMERIC(4,1),
    included_photos INTEGER,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT pk_packages PRIMARY KEY (id)
);

-- ─────────────────────────────────────────
--  BOOKINGS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
    id                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    client_id            UUID         REFERENCES clients (id) ON DELETE SET NULL,
    lead_id              UUID,
    client_name          VARCHAR(200) NOT NULL,
    client_email         VARCHAR(320) NOT NULL,
    event_date           DATE         NOT NULL,
    event_time           TIME,
    event_type           VARCHAR(50),
    location             VARCHAR(300),
    package_id           UUID         REFERENCES packages (id) ON DELETE SET NULL,
    total_amount_cents   INTEGER      NOT NULL DEFAULT 0,
    deposit_amount_cents INTEGER      NOT NULL DEFAULT 0,
    status               VARCHAR(30)  NOT NULL DEFAULT 'ENQUIRY',
    internal_notes       TEXT,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_bookings        PRIMARY KEY (id),
    CONSTRAINT chk_booking_status CHECK (
        status IN ('ENQUIRY','CONFIRMED','DEPOSIT_PAID','FULLY_PAID','COMPLETED','CANCELLED')
    )
);

CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON bookings (event_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings (status);

-- ─────────────────────────────────────────
--  LEADS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
    id           UUID         NOT NULL DEFAULT gen_random_uuid(),
    name         VARCHAR(200) NOT NULL,
    email        VARCHAR(320) NOT NULL,
    phone        VARCHAR(30),
    event_date   DATE,
    event_type   VARCHAR(50),
    budget_range VARCHAR(30),
    message      TEXT,
    score        VARCHAR(10)  NOT NULL DEFAULT 'LOW',
    status       VARCHAR(20)  NOT NULL DEFAULT 'NEW',
    ip_address   VARCHAR(45),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_leads        PRIMARY KEY (id),
    CONSTRAINT chk_lead_score  CHECK (score  IN ('HIGH','MED','LOW')),
    CONSTRAINT chk_lead_status CHECK (status IN ('NEW','REPLIED','BOOKED','REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_leads_score  ON leads (score);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);

-- ─────────────────────────────────────────
--  GALLERIES (delivery)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS galleries (
    id               UUID         NOT NULL DEFAULT gen_random_uuid(),
    booking_id       UUID         REFERENCES bookings (id) ON DELETE CASCADE,
    access_token     VARCHAR(64)  NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text),
    expires_at       TIMESTAMPTZ,
    download_enabled BOOLEAN      NOT NULL DEFAULT true,
    watermark_enabled BOOLEAN     NOT NULL DEFAULT false,
    view_count       INTEGER      NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_galleries        PRIMARY KEY (id),
    CONSTRAINT uq_gallery_token    UNIQUE (access_token)
);

-- ─────────────────────────────────────────
--  DELIVERY PHOTOS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_photos (
    id                UUID         NOT NULL DEFAULT gen_random_uuid(),
    gallery_id        UUID         NOT NULL REFERENCES galleries (id) ON DELETE CASCADE,
    r2_key            VARCHAR(500) NOT NULL,
    thumbnail_key     VARCHAR(500),
    original_filename VARCHAR(255),
    file_size_bytes   BIGINT,
    width             INTEGER,
    height            INTEGER,
    sort_order        INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT pk_delivery_photos PRIMARY KEY (id)
);
