CREATE TABLE users (
    id             UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id      UUID         NOT NULL,
    email          VARCHAR(320) NOT NULL,
    password_hash  VARCHAR(255),
    role           VARCHAR(20)  NOT NULL DEFAULT 'OWNER',
    full_name      VARCHAR(200),
    avatar_url     VARCHAR(500),
    last_login_at  TIMESTAMPTZ,

    CONSTRAINT pk_users              PRIMARY KEY (id),
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email),
    CONSTRAINT chk_users_role        CHECK (role IN ('OWNER', 'ASSISTANT')),
    CONSTRAINT fk_users_tenant       FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
);
