-- Executed before each integration test method to produce a clean slate.
-- Drop all tenant schemas first so Flyway re-runs migrations on re-created tenants.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'tenant_%'
    LOOP
        EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(r.schema_name) || ' CASCADE';
    END LOOP;
END;
$$;

DELETE FROM refresh_tokens;
DELETE FROM users;
DELETE FROM tenants;
