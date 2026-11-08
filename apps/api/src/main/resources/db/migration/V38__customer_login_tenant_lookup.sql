-- Which studios know a customer by this address — for sign-in by email alone.
--
-- A client signing in used to have to type their photographer's subdomain,
-- which nobody remembers. Signing in by email instead means asking, before any
-- studio is known, "which studios have this person as a client?". Two places
-- hold the answer:
--
--   users     — global (no RLS): customers who have signed in before. The
--               application reads this table directly.
--   bookings  — tenant-isolated (RLS, V11): clients the photographer booked
--               who have never signed in. Under RLS the application role sees
--               exactly one tenant per transaction, so no ordinary query can
--               ask this across studios. That is what this function is for.
--
-- How it answers without weakening isolation: it is SECURITY INVOKER (the
-- default, stated anyway). It runs as fotolio_app, under the very same
-- *_tenant_isolation policies, and simply binds app.tenant_id to each studio in
-- turn — the same thing TenantRoutingDataSource does for every request — asking
-- one yes/no question per studio. It returns tenant ids only, never a booking
-- or an address, and restores the caller's tenant binding before returning.
-- A SECURITY DEFINER version would not even work here: the policies are
-- granted TO fotolio_app, so as any other owner FORCE ROW LEVEL SECURITY would
-- leave it seeing nothing — and making it work would mean BYPASSRLS, which is
-- precisely the privilege the platform must never hand out.
--
-- Cost: one indexed EXISTS per active studio (idx_bookings_client_email_upper,
-- V11). Fine at today's scale; at many thousands of studios this becomes a
-- global, hashed email→tenant index maintained on booking writes instead.
CREATE OR REPLACE FUNCTION customer_login_tenants(p_email TEXT)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_previous TEXT := current_setting('app.tenant_id', true);
    v_tenant   UUID;
BEGIN
    IF p_email IS NULL OR btrim(p_email) = '' THEN
        RETURN;
    END IF;

    FOR v_tenant IN SELECT id FROM tenants WHERE status = 'ACTIVE' LOOP
        PERFORM set_config('app.tenant_id', v_tenant::TEXT, true);
        IF EXISTS (
            SELECT 1 FROM bookings b
            WHERE upper(b.client_email) = upper(btrim(p_email))
        ) THEN
            RETURN NEXT v_tenant;
        END IF;
    END LOOP;

    PERFORM set_config('app.tenant_id', COALESCE(v_previous, ''), true);
END
$$;

REVOKE ALL ON FUNCTION customer_login_tenants(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION customer_login_tenants(TEXT) TO fotolio_app;
