-- Replaces schema-per-tenant isolation with Row-Level Security.
--
-- Previously each tenant had its own Postgres schema (tenant_<uuid>,
-- created by TenantSchemaInitializer from db/tenant-migration/*), and every
-- request set `SET search_path TO tenant_xxx` on its JDBC connection
-- (TenantRoutingDataSource). That's a session-level GUC: it's unsafe against
-- Supabase's Supavisor transaction-mode pooler (port 6543), which the app is
-- expected to run behind — the pooler can hand different transactions on the
-- same client connection to different Postgres backends, so a `SET` issued
-- for one tenant can silently fail to apply (or leak) on a later statement.
--
-- This migration moves the 9 tables that used to live per-tenant-schema into
-- `public` with an explicit `tenant_id` column, and enforces isolation with
-- RLS instead: a `set_config('app.tenant_id', ?, true)` issued as the first
-- statement of each transaction (see TenantRoutingDataSource), which is safe
-- under transaction pooling because it can never be separated from the
-- queries it protects by a pooler backend swap.
--
-- No production data exists for this app yet, so this is a clean schema
-- replacement, not a data migration. The old db/tenant-migration/ folder is
-- deleted alongside this file.

-- ─────────────────────────────────────────
--  Runtime role — least privilege, RLS-bound
-- ─────────────────────────────────────────
-- The app connects as this role at runtime (DB_USERNAME), never as the
-- owning/migration role (FLYWAY_USER). No password is set here — that's a
-- deploy-time step (see infra/README.md) so no credential lands in version
-- control.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fotolio_app') THEN
        CREATE ROLE fotolio_app LOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO fotolio_app;

-- Tables created by earlier migrations (V1-V10) already live in `public` and
-- were owned by the migration/owner role — fotolio_app has never had any
-- privilege on them. Without this grant, switching the app's runtime
-- connection to fotolio_app breaks login, registration, refresh, and audit
-- logging outright (permission denied on every query). These tables are
-- intentionally NOT given RLS policies in this migration (see the file
-- header) — they keep relying on their existing app-level tenant_id/user_id
-- filtering — but the app still needs plain DML access to use them at all.
GRANT SELECT, INSERT, UPDATE, DELETE ON
    tenants, users, refresh_tokens, audit_log,
    magic_link_tokens, email_verification_tokens, password_reset_tokens
TO fotolio_app;

-- ─────────────────────────────────────────
--  CATEGORIES
-- ─────────────────────────────────────────
-- created_at was missing from the original per-tenant-schema DDL even though
-- Category.java has always mapped @CreationTimestamp to it — category
-- creation has been broken (SQLGrammarException on every insert) since
-- whenever that entity field was added, just never caught because nothing
-- exercised it against a real Postgres schema. Added here while touching
-- this table's DDL anyway; unrelated to RLS itself.
CREATE TABLE categories (
    id         UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id  UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    sort_order INTEGER      NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_categories PRIMARY KEY (id)
);

CREATE INDEX idx_categories_tenant_id ON categories (tenant_id);

-- ─────────────────────────────────────────
--  PHOTOS (portfolio)
-- ─────────────────────────────────────────
CREATE TABLE photos (
    id              UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id       UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    category_id     UUID,
    r2_key          VARCHAR(500) NOT NULL,
    thumbnail_key   VARCHAR(500),
    file_size_bytes BIGINT,
    width           INTEGER,
    height          INTEGER,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    is_published    BOOLEAN      NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_photos PRIMARY KEY (id)
);

CREATE INDEX idx_photos_tenant_id ON photos (tenant_id);
CREATE INDEX idx_photos_sort      ON photos (sort_order);

-- ─────────────────────────────────────────
--  CLIENTS
-- ─────────────────────────────────────────
CREATE TABLE clients (
    id                 UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id          UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
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
    CONSTRAINT pk_clients PRIMARY KEY (id),
    -- Was a bare UNIQUE(email) in the per-tenant schema, where physical
    -- separation made cross-tenant collisions impossible. Now that all
    -- tenants share one table, uniqueness has to be scoped per tenant
    -- explicitly, or two different photographers could never both have a
    -- client with the same email address. Postgres enforces UNIQUE via a
    -- global index scan that RLS does not filter, so this has to be a
    -- composite constraint, not app-level tenant scoping.
    CONSTRAINT uq_client_tenant_email UNIQUE (tenant_id, email)
);

CREATE INDEX idx_clients_tenant_id ON clients (tenant_id);

-- ─────────────────────────────────────────
--  PACKAGES
-- ─────────────────────────────────────────
CREATE TABLE packages (
    id              UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id       UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    price_cents     INTEGER      NOT NULL,
    currency        VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    duration_hours  NUMERIC(4,1),
    included_photos INTEGER,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT pk_packages PRIMARY KEY (id)
);

CREATE INDEX idx_packages_tenant_id ON packages (tenant_id);

-- ─────────────────────────────────────────
--  BOOKINGS
-- ─────────────────────────────────────────
CREATE TABLE bookings (
    id                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id            UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    client_id            UUID         REFERENCES clients (id) ON DELETE SET NULL,
    lead_id              UUID,
    inquiry_id           UUID,
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

CREATE INDEX idx_bookings_tenant_id           ON bookings (tenant_id);
CREATE INDEX idx_bookings_event_date          ON bookings (event_date);
CREATE INDEX idx_bookings_status              ON bookings (status);
CREATE INDEX idx_bookings_client_id           ON bookings (client_id);
CREATE INDEX idx_bookings_client_email_upper  ON bookings (upper(client_email));

-- ─────────────────────────────────────────
--  LEADS
-- ─────────────────────────────────────────
CREATE TABLE leads (
    id             UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id      UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    name           VARCHAR(200) NOT NULL,
    email          VARCHAR(320) NOT NULL,
    phone          VARCHAR(30),
    event_date     DATE,
    event_type     VARCHAR(50),
    budget_range   VARCHAR(30),
    message        TEXT,
    internal_notes TEXT,
    score          VARCHAR(10)  NOT NULL DEFAULT 'LOW',
    status         VARCHAR(20)  NOT NULL DEFAULT 'NEW',
    ip_address     VARCHAR(45),
    source         VARCHAR(30),
    ig_message_id  VARCHAR(100),
    ig_username    VARCHAR(100),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_leads        PRIMARY KEY (id),
    CONSTRAINT chk_lead_score  CHECK (score  IN ('HIGH','MED','LOW')),
    CONSTRAINT chk_lead_status CHECK (status IN ('NEW','REPLIED','BOOKED','REJECTED'))
);

CREATE INDEX idx_leads_tenant_id      ON leads (tenant_id);
CREATE INDEX idx_leads_score          ON leads (score);
CREATE INDEX idx_leads_status         ON leads (status);
CREATE INDEX idx_leads_created_at     ON leads (created_at DESC);
CREATE INDEX idx_leads_ig_message_id  ON leads (ig_message_id) WHERE ig_message_id IS NOT NULL;

-- ─────────────────────────────────────────
--  GALLERIES (delivery)
-- ─────────────────────────────────────────
CREATE TABLE galleries (
    id                 UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id          UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    booking_id         UUID         REFERENCES bookings (id) ON DELETE CASCADE,
    -- CSPRNG default (gen_random_uuid, not md5(random())) — see the original
    -- rationale in the now-deleted db/tenant-migration/V9. The app always
    -- supplies its own token on insert; this default is defence-in-depth for
    -- any raw insert that doesn't.
    access_token       VARCHAR(64)  NOT NULL
        DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    expires_at         TIMESTAMPTZ,
    download_enabled   BOOLEAN      NOT NULL DEFAULT true,
    watermark_enabled  BOOLEAN      NOT NULL DEFAULT false,
    view_count         INTEGER      NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_galleries     PRIMARY KEY (id),
    -- Deliberately left as a globally-unique bearer token (not scoped to
    -- tenant_id): it's a capability secret handed to an anonymous client, and
    -- global uniqueness means a lookup by token alone can never resolve into
    -- a different tenant's gallery even if a caller forgot to also filter by
    -- tenant. Effectively unguessable collisions aside, this is a strictly
    -- safer property than the old per-schema uniqueness gave us.
    CONSTRAINT uq_gallery_token UNIQUE (access_token)
);

CREATE INDEX idx_galleries_tenant_id ON galleries (tenant_id);

-- ─────────────────────────────────────────
--  DELIVERY PHOTOS
-- ─────────────────────────────────────────
CREATE TABLE delivery_photos (
    id                UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id         UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
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

CREATE INDEX idx_delivery_photos_tenant_id ON delivery_photos (tenant_id);

-- ─────────────────────────────────────────
--  INQUIRY REQUESTS (authenticated-customer intake)
-- ─────────────────────────────────────────
-- customer_id references public.users, but deliberately has no FK: the old
-- per-tenant-schema comment said cross-schema FKs aren't supported in
-- Postgres, which no longer applies now that everything is in `public` — but
-- adding a new FK here would be a behaviour change (rejecting inserts that
-- previously succeeded) outside the scope of this migration, so the
-- constraint is left exactly as unenforced as it was before.
CREATE TABLE inquiry_requests (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id     UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
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
    CONSTRAINT chk_inquiry_score   CHECK (score  IN ('HIGH', 'MED', 'LOW')),
    CONSTRAINT chk_inquiry_status  CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'BOOKING_CREATED'))
);

CREATE INDEX idx_inquiry_requests_tenant_id   ON inquiry_requests (tenant_id);
CREATE INDEX idx_inquiry_requests_status      ON inquiry_requests (status);
CREATE INDEX idx_inquiry_requests_created_at  ON inquiry_requests (created_at DESC);
CREATE INDEX idx_inquiry_requests_customer    ON inquiry_requests (customer_id);

-- ─────────────────────────────────────────
--  Grants + Row-Level Security
-- ─────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON
    categories, photos, clients, packages, bookings,
    leads, galleries, delivery_photos, inquiry_requests
TO fotolio_app;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'categories', 'photos', 'clients', 'packages', 'bookings',
        'leads', 'galleries', 'delivery_photos', 'inquiry_requests'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        -- FORCE matters even though fotolio_app doesn't own these tables:
        -- without it, RLS only applies to non-owner roles by default, which
        -- happens to be fine for fotolio_app today — FORCE is defence in
        -- depth against this table ever being queried by the owning/migration
        -- role at runtime, or a future role change silently disabling
        -- isolation.
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
