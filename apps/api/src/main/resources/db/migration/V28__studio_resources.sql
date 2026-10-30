-- The things a shoot needs besides a photographer: a room, a lighting kit, a
-- second body, the car.
--
-- One table for both rooms and equipment, because the question the studio
-- actually asks is the same for both — "is this free that day" — and the
-- answer is computed the same way. Splitting them would mean two tables, two
-- endpoints and two conflict checks that must agree with each other forever,
-- to gain a distinction that only shows up as a label.
CREATE TABLE studio_resources (
    id         UUID         NOT NULL DEFAULT gen_random_uuid(),
    tenant_id  UUID         NOT NULL,
    name       VARCHAR(120) NOT NULL,
    -- ROOM or EQUIPMENT. Not a constraint: the list is presentational — it
    -- decides an icon and a grouping — and a studio that wants a third kind
    -- should not need a migration to get one.
    kind       VARCHAR(20)  NOT NULL DEFAULT 'EQUIPMENT',
    notes      TEXT,
    -- Retired rather than deleted. A resource that shot fifty bookings cannot
    -- be removed without either deleting that history or leaving it dangling,
    -- and "we sold that lens" is not a reason to lose the record of what shot
    -- last year's weddings.
    active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT pk_studio_resources PRIMARY KEY (id),
    CONSTRAINT fk_studio_resources_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants (id) ON DELETE CASCADE,
    -- One name per studio, so "Studio A" cannot exist twice and make a
    -- conflict warning ambiguous about which one is booked.
    CONSTRAINT uq_studio_resources_name UNIQUE (tenant_id, name)
);

CREATE INDEX idx_studio_resources_tenant ON studio_resources (tenant_id, active, name);

-- What a booking is using. A join table rather than a column on bookings,
-- because a shoot uses several things at once — a room and two lights — and
-- the alternative is a comma-separated column that no conflict query can use.
CREATE TABLE booking_resources (
    booking_id  UUID NOT NULL,
    resource_id UUID NOT NULL,

    CONSTRAINT pk_booking_resources PRIMARY KEY (booking_id, resource_id),
    -- CASCADE here, unlike the photographer assignment: this row *is* the
    -- link, with nothing of its own to preserve. Deleting the booking should
    -- take it, and retiring a resource is `active = false`, not a delete.
    CONSTRAINT fk_booking_resources_booking FOREIGN KEY (booking_id)
        REFERENCES bookings (id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_resources_resource FOREIGN KEY (resource_id)
        REFERENCES studio_resources (id) ON DELETE CASCADE
);

-- The conflict query's direction: given a resource, which bookings hold it.
CREATE INDEX idx_booking_resources_resource ON booking_resources (resource_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON studio_resources  TO fotolio_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON booking_resources TO fotolio_app;

-- Both carry tenant data and are only ever read inside an authenticated
-- request, so unlike staff_invitations they get the ordinary policy.
ALTER TABLE studio_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_resources FORCE ROW LEVEL SECURITY;
CREATE POLICY studio_resources_tenant_isolation ON studio_resources
    FOR ALL TO fotolio_app
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- booking_resources has no tenant_id of its own — it is scoped through the
-- booking it belongs to, which RLS already protects. Duplicating the column
-- would create a second source of truth that could disagree with the first.
ALTER TABLE booking_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_resources FORCE ROW LEVEL SECURITY;
CREATE POLICY booking_resources_tenant_isolation ON booking_resources
    FOR ALL TO fotolio_app
    USING (EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.id = booking_resources.booking_id
          AND b.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid))
    WITH CHECK (EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.id = booking_resources.booking_id
          AND b.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid));
