CREATE TABLE IF NOT EXISTS photos (
    id         UUID         NOT NULL DEFAULT gen_random_uuid(),
    title      VARCHAR(255) NOT NULL,
    file_url   VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_photos PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS categories (
    id   UUID         NOT NULL DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    CONSTRAINT pk_categories PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS clients (
    id        UUID         NOT NULL DEFAULT gen_random_uuid(),
    full_name VARCHAR(200) NOT NULL,
    email     VARCHAR(320),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_clients PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS galleries (
    id        UUID         NOT NULL DEFAULT gen_random_uuid(),
    title     VARCHAR(255) NOT NULL,
    client_id UUID         REFERENCES clients (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_galleries PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS leads (
    id        UUID         NOT NULL DEFAULT gen_random_uuid(),
    full_name VARCHAR(200) NOT NULL,
    email     VARCHAR(320),
    message   TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_leads PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS bookings (
    id         UUID        NOT NULL DEFAULT gen_random_uuid(),
    client_id  UUID        REFERENCES clients (id) ON DELETE SET NULL,
    shoot_date DATE        NOT NULL,
    status     VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_bookings PRIMARY KEY (id)
);
