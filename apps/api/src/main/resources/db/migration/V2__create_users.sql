CREATE TABLE users (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id     UUID         NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(50)  NOT NULL DEFAULT 'USER',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_users              PRIMARY KEY (id),
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email),
    CONSTRAINT chk_users_role        CHECK (role IN ('USER', 'ADMIN', 'PHOTOGRAPHER')),
    CONSTRAINT fk_users_tenant       FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT
);
