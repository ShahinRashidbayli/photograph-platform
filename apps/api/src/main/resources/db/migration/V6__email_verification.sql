-- Track which users have confirmed ownership of their email address.
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

-- One-time verification tokens. Token plaintext is sent in the verification
-- email; only its SHA-256 hash is stored, mirroring the refresh-token pattern
-- so a database compromise cannot be used to verify arbitrary accounts.
CREATE TABLE email_verification_tokens (
    id           UUID         NOT NULL DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL,
    token_hash   VARCHAR(64)  NOT NULL,
    expires_at   TIMESTAMPTZ  NOT NULL,
    used_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_email_verification_tokens          PRIMARY KEY (id),
    CONSTRAINT uq_email_verification_tokens_hash     UNIQUE (token_hash),
    CONSTRAINT fk_email_verification_tokens_user     FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_email_verification_tokens_user ON email_verification_tokens (user_id, created_at DESC);
