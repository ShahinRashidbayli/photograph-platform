-- "I would use this" — a photographer marking interest in something not built.
--
-- Six ideas are on the roadmap (docs/VISION_AND_EXTENSIBILITY.md §4) and only
-- one of them can be built first. That order is currently a guess. This table
-- turns it into a count.
--
-- Deliberately not an analytics event: an event says someone looked at a page,
-- which is mostly a measure of where the link sits. A row here is a photographer
-- saying they want the thing, and it can be withdrawn — which is what makes the
-- number worth reading.

CREATE TABLE feature_interest (
    tenant_id  UUID        NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    -- The roadmap key, e.g. LOCATION_MAP. Not a foreign key: these ideas have
    -- no rows anywhere yet, which is the point of the table.
    feature    VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One vote per studio per idea. The primary key is the whole rule, so a
    -- double-click cannot inflate the count that decides what gets built.
    CONSTRAINT pk_feature_interest PRIMARY KEY (tenant_id, feature)
);

-- The tally: "how many studios want each idea", which is the only query the
-- table exists to answer.
CREATE INDEX idx_feature_interest_feature ON feature_interest (feature);
