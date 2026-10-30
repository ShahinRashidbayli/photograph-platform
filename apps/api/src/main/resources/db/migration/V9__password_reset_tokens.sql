-- One-time password-reset tokens. Same shape as email_verification_tokens: the
-- plaintext token travels only in the email, and just its SHA-256 hash is
-- stored, so a database compromise cannot be replayed into account takeover.
--
-- Shorter-lived than a verification token by design (1h vs 24h) — a reset link
-- is a bearer credential for the account itself, so a leaked one must decay
-- fast.
CREATE TABLE password_reset_tokens (
    id           UUID         NOT NULL DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL,
    token_hash   VARCHAR(64)  NOT NULL,
    expires_at   TIMESTAMPTZ  NOT NULL,
    used_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_password_reset_tokens      PRIMARY KEY (id),
    CONSTRAINT uq_password_reset_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens (user_id, created_at DESC);
