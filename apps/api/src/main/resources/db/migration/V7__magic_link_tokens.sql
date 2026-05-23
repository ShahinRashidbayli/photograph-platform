-- One-time magic-link login tokens for customers (passwordless auth).
--
-- Differs from email_verification_tokens: this is a *login* primitive
-- (granting a session), not a one-shot ownership proof. We still mirror the
-- security pattern: plaintext token in the email, only its SHA-256 hash in
-- the database, single-use, time-bounded. A leaked DB row therefore cannot
-- be used to log in as another user.
CREATE TABLE magic_link_tokens (
    id           UUID         NOT NULL DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL,
    token_hash   VARCHAR(64)  NOT NULL,
    expires_at   TIMESTAMPTZ  NOT NULL,
    used_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_magic_link_tokens          PRIMARY KEY (id),
    CONSTRAINT uq_magic_link_tokens_hash     UNIQUE (token_hash),
    CONSTRAINT fk_magic_link_tokens_user     FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_magic_link_tokens_user ON magic_link_tokens (user_id, created_at DESC);
