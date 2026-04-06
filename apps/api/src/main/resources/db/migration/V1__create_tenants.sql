CREATE TABLE tenants (
    id         UUID         NOT NULL DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    slug       VARCHAR(100) NOT NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_tenants    PRIMARY KEY (id),
    CONSTRAINT uq_tenants_slug UNIQUE (slug)
);
