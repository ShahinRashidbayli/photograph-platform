-- Makes the database enforce the email rule the code already assumed.
--
-- `users` only ever had UNIQUE (tenant_id, email). `idx_users_email` is a
-- plain, non-unique index. But `UserRepository.findByEmail(String)` returned
-- an Optional — asserting at most one row per address platform-wide — and four
-- call sites depended on that: photographer login, password reset, the public
-- portfolio page's owner lookup, and gallery watermark rendering.
--
-- Nothing stopped the second row from existing. CustomerAuthService creates a
-- customer with findByTenantIdAndEmail(...).orElseGet(create), scoped to one
-- tenant and with no global check, so ONE PERSON BOOKING TWO PHOTOGRAPHERS ON
-- THIS PLATFORM produced two rows with the same address. Not a race — the
-- designed behaviour. From that moment findByEmail threw
-- IncorrectResultSizeDataAccessException and those four paths answered 500,
-- with no way to recover from inside the product. If the second photographer's
-- own address was the one duplicated, their entire public portfolio and every
-- client gallery on it went down.
--
-- ─────────────────────────────────────────
--  The rule, stated once
-- ─────────────────────────────────────────
-- Uniqueness follows how each role actually authenticates, which the app
-- already decided and then failed to write down:
--
--   STAFF (PHOTOGRAPHER / ADMIN) — globally unique.
--     AuthService.login takes an email and a password and NO tenant hint, so
--     the address has to resolve to exactly one account platform-wide. Note
--     tenants.owner_email is already globally UNIQUE (uq_tenants_email), so
--     this is not a new restriction; it closes the gap where users could
--     disagree with tenants.
--
--   CUSTOMER — unique per tenant, which UNIQUE (tenant_id, email) already
--     gives. Customers sign in through a magic link addressed as
--     /{subdomain}, so the tenant is always known before the lookup and a
--     shared address across photographers is legitimate — it is the same
--     person, hiring two businesses.
--
-- One address may therefore hold one staff account AND one customer account
-- per other tenant. That combination is deliberate: a photographer who books
-- another photographer is a customer of theirs, and refusing that would be a
-- worse bug than the one being fixed.

-- Fails loudly if duplicates already exist rather than silently skipping them.
-- Resolving one means deciding which account is the real staff account, which
-- is not a decision a migration should make on someone's behalf.
CREATE UNIQUE INDEX uq_users_staff_email
    ON users (email)
    WHERE role <> 'CUSTOMER';

-- The old catch-all is now redundant for staff and unhelpfully broad for
-- customers, whose lookups are always (tenant_id, email) — already served by
-- uq_users_tenant_email. Kept only as the supporting index for the
-- role-filtered staff lookup, which the partial unique index above covers.
DROP INDEX IF EXISTS idx_users_email;
