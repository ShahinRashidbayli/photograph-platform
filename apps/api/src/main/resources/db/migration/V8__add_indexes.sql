-- Login (AuthService.login → UserRepository.findByEmail) does a tenant-agnostic
-- lookup by email alone. The existing UNIQUE (tenant_id, email) constraint
-- only indexes the composite — Postgres cannot use it for a query that filters
-- on email alone, so login currently triggers a sequential scan on the users
-- table. At 700+ tenants this becomes the slowest query in the auth path.
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
