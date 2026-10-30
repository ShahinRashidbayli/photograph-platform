-- Our own billing: the subscription that decides whether a tenant may write.
--
-- Until now the 14-day trial existed only as landing-page copy. `trial_ends_at`
-- was a column nothing ever wrote (PRICING.md §1: "The copy promises a 14-day
-- trial; nothing happens when it ends"), and `plan` came straight off the
-- registration request — so a tenant could POST plan=STUDIO and stay there
-- forever, for free. RegisterRequest's own javadoc flagged that the field
-- "stops being true the moment plan gates or billing land".
--
-- This migration makes the trial real and gives the plan a source of truth
-- that is not the client: Stripe's subscription state.
--
-- Note this is OUR subscription (photographer pays Fotolio), which is a
-- different flow from the Stripe Connect columns added in V17 (client pays
-- photographer, we take a commission). They share a table and nothing else:
-- one bills our customer, the other moves our customer's customer's money.

ALTER TABLE tenants
    ADD COLUMN stripe_customer_id     VARCHAR(255),
    ADD COLUMN stripe_subscription_id VARCHAR(255),
    ADD COLUMN subscription_status    VARCHAR(30) NOT NULL DEFAULT 'TRIALING',
    ADD COLUMN current_period_end     TIMESTAMPTZ;

-- Mirrors Stripe's subscription statuses, plus NONE for "never subscribed".
-- Kept as our own uppercase vocabulary rather than Stripe's lowercase strings
-- so the column stays readable if the provider is ever swapped, and so an
-- unrecognised future Stripe status cannot silently widen access — the mapper
-- has to name it.
ALTER TABLE tenants
    ADD CONSTRAINT chk_tenants_subscription_status CHECK (subscription_status IN (
        'NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'UNPAID'
    ));

-- One tenant per Stripe customer/subscription, so a duplicated webhook or a
-- double checkout cannot attach the same subscription to two tenants.
CREATE UNIQUE INDEX uq_tenants_stripe_customer
    ON tenants (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX uq_tenants_stripe_subscription
    ON tenants (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Existing rows predate the trial being enforced. Give them a full window from
-- now rather than from their (possibly months-old) created_at: retroactively
-- expiring an account that was never told it had a deadline would lock a
-- working tenant out of writes on deploy day. PRICING.md §7.8 asks how
-- existing tenants are treated when gates land; this is that answer, and it is
-- the generous one.
UPDATE tenants
   SET trial_ends_at = now() + INTERVAL '14 days'
 WHERE trial_ends_at IS NULL;

COMMENT ON COLUMN tenants.subscription_status IS
    'Our own subscription with the photographer. Drives the read-only lock in '
    'EntitlementService: writes stop when the trial has expired and this is not '
    'TRIALING or ACTIVE. Distinct from the stripe_* Connect columns (V17), '
    'which describe the photographer''s ability to be paid BY their clients.';

COMMENT ON COLUMN tenants.trial_ends_at IS
    'End of the 14-day trial advertised on the landing page. Written at '
    'registration. After it passes, an account without an ACTIVE subscription '
    'goes read-only (PRICING.md §7.7) — reads and delivered galleries keep '
    'working, writes do not.';
