-- Customer login moves from a magic *link* to a 6-digit *code*.
--
-- Why: customers arrive from an Instagram bio link, so the page opens inside
-- Instagram's in-app browser. A magic link forces them out to their mail app and
-- back through a different browser — the funnel's biggest drop-off, and the
-- reason a link that works perfectly still loses sign-ins. A code is typed back
-- into the tab they are already in, so they never leave.
--
-- The table keeps its name and shape; only what it stores changes. token_hash
-- now holds sha256(user_id + ':' + code) rather than the hash of a long random
-- token. The user id acts as a per-row salt: a 6-digit code has only a million
-- possible values, so an unsalted hash would be reversible from a database leak
-- with a table anyone can precompute. Salting forces that work to be redone per
-- user, which — together with the short TTL and the attempt cap below — is the
-- standard OTP trade-off. It is genuinely weaker against a DB leak than the old
-- 256-bit token; the conversion gain is judged worth it, and the blast radius is
-- one customer's session on one photographer's tenant.
ALTER TABLE magic_link_tokens
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN magic_link_tokens.attempts IS
    'Failed verification attempts. Capped in CustomerAuthService so a six-digit '
    'code cannot be brute-forced within its lifetime.';
