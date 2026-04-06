CREATE TABLE tenants (
    id          UUID         NOT NULL DEFAULT gen_random_uuid(),
    subdomain   VARCHAR(63)  NOT NULL,
    owner_email VARCHAR(320) NOT NULL,
    plan        VARCHAR(20)  NOT NULL DEFAULT 'STARTER',
    schema_name VARCHAR(63)  GENERATED ALWAYS AS ('tenant_' || replace(id::text, '-', '')) STORED,
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    trial_ends_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_tenants           PRIMARY KEY (id),
    CONSTRAINT uq_tenants_subdomain UNIQUE (subdomain),
    CONSTRAINT uq_tenants_email     UNIQUE (owner_email),
    CONSTRAINT chk_tenants_plan     CHECK (plan IN ('STARTER', 'PRO', 'STUDIO')),
    CONSTRAINT chk_tenants_status   CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CANCELLED'))
);
