-- Makes signing out, and resetting a password, actually end the session.
--
-- Access tokens are self-contained JWTs: the filter verifies the signature and
-- the expiry and asks nothing else. Nothing could revoke one, so logout()
-- invalidated refresh tokens and left the access token alive for the rest of
-- its 24-hour life.
--
-- For "sign out" that is untidy. For password reset it is a real hole, and the
-- reset code says so itself — its comment reads "the whole point of a reset is
-- usually that someone else may be inside the account" — and then revokes only
-- the refresh token. The attacker's ACCESS token kept working for up to a day
-- after the victim changed their password. Nothing in the product could kick
-- them out.
--
-- ─────────────────────────────────────────
--  How the column is used
-- ─────────────────────────────────────────
-- Every JWT carries `iat` (issued-at). A token is refused when it was issued
-- before this instant, so writing now() here invalidates every token that
-- exists for that user, in one statement, immediately.
--
-- Set on: logout, password reset, and any future "sign out everywhere".
--
-- NULL means "nothing revoked yet", which is the state every existing row
-- starts in — deliberately not defaulted to now(), which would sign out every
-- current session the moment this migration runs.
ALTER TABLE users
    ADD COLUMN tokens_valid_after TIMESTAMPTZ;

COMMENT ON COLUMN users.tokens_valid_after IS
    'Access tokens issued before this instant are refused. Written on logout '
    'and password reset; NULL means nothing has been revoked. Enforced by '
    'JwtAuthFilter via SessionRevocation.';
