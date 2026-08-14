-- Runs once, automatically, when the postgres container initializes an empty
-- data volume (docker-entrypoint-initdb.d convention). Creates the
-- least-privilege runtime role the app connects as (DB_USERNAME) — separate
-- from the `postgres` superuser that Flyway migrations run as (FLYWAY_USER)
-- — so RLS (see apps/api/.../db/migration/V11__tenant_rls.sql) actually
-- applies to the app's connections.
--
-- Fixed password: this is local dev only, never committed with real
-- credentials, and never runs against an existing (non-empty) data volume —
-- see infra/README.md if you need to (re-)apply it to an existing container.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fotolio_app') THEN
        CREATE ROLE fotolio_app LOGIN PASSWORD 'fotolio_app_dev_password';
    END IF;
END
$$;
