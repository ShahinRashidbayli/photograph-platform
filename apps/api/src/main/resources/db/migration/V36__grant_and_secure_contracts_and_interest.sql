-- Repairs V34 and V35: both created a table and neither granted the runtime
-- role access to it, nor put it behind row-level security.
--
-- Flyway runs as the schema owner, so `CREATE TABLE` succeeded and the
-- migrations looked clean. The application connects as `fotolio_app`, which has
-- no rights it was not given, so the first authenticated read failed with
-- "permission denied for table feature_interest". `contracts` (V34) has the
-- same defect and had simply not been exercised yet: every check made against
-- it so far was either an unauthenticated 401, which never reaches the table,
-- or a unit test with a mocked repository.
--
-- A separate migration rather than an edit to V34/V35, which are applied and
-- checksummed.
--
-- RLS matters here as much as the grant. Both tables are keyed by tenant_id and
-- both are read on paths that already resolve a tenant from the JWT; the policy
-- is the backstop for the day a query forgets its WHERE clause — see V11 for
-- the full reasoning behind `app.tenant_id`.

-- ─────────────────────────────────────────
--  CONTRACTS (V34)
-- ─────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON contracts TO fotolio_app;

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;

-- The customer side is covered by the same policy rather than needing one of
-- its own: a customer's JWT carries the photographer's tenant (they sign up
-- into an existing studio), so `app.tenant_id` is set to the same value the
-- contract holds. Which contracts a customer may see is narrower than the
-- tenant — their own address, and never a draft — and that stays in
-- ContractRepository, where it belongs. RLS is the floor, not the whole rule.
CREATE POLICY contracts_tenant_isolation ON contracts
    FOR ALL TO fotolio_app
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- ─────────────────────────────────────────
--  FEATURE INTEREST (V35)
-- ─────────────────────────────────────────
-- No UPDATE: a row is created or deleted, never edited. The identity is the
-- (tenant, feature) pair, so there is nothing on it that could change.
GRANT SELECT, INSERT, DELETE ON feature_interest TO fotolio_app;

ALTER TABLE feature_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_interest FORCE ROW LEVEL SECURITY;

CREATE POLICY feature_interest_tenant_isolation ON feature_interest
    FOR ALL TO fotolio_app
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
