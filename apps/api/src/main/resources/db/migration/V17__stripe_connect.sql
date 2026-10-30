-- Stripe Connect (Express) — the payment architecture PRICING.md §4 makes
-- binding, replacing the platform-account PaymentIntents V14 shipped with.
--
-- Why this is not a refactor but a correction: the commercial model decided on
-- 2026-07-17 is that the *photographer* collects the money and the platform
-- takes a commission (2% on Starter, 0% on Pro/Studio) out of it. A plain
-- PaymentIntent on the platform's own account inverts that — the money lands
-- with us, while the §14 UStG invoice naming the photographer as the issuer
-- says it landed with them. Direct charges on a connected Express account put
-- the funds where the invoice says they went, and `application_fee_amount`
-- takes the commission off the top.
--
-- No production data exists on the payments table yet, so the new columns are
-- plain additions rather than a backfill.

ALTER TABLE tenants
    -- acct_… of the connected Express account. NULL until the photographer
    -- starts onboarding; the account exists at Stripe from that moment on,
    -- long before it can actually accept a charge.
    ADD COLUMN stripe_account_id        VARCHAR(255),
    -- Mirrors of the connected account's capability flags, kept fresh by the
    -- account.updated webhook and by an explicit refresh when the
    -- photographer returns from Stripe's hosted onboarding. Cached rather
    -- than read live because they gate the "can this tenant be paid?" branch
    -- on the payment path, which must not depend on an outbound Stripe call.
    ADD COLUMN stripe_charges_enabled   BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN stripe_payouts_enabled   BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN stripe_details_submitted BOOLEAN     NOT NULL DEFAULT false,
    -- First moment charges_enabled went true — the onboarding-completed
    -- timestamp, kept separately from created_at so it survives a later
    -- capability lapse (Stripe can disable charges pending re-verification).
    ADD COLUMN stripe_onboarded_at      TIMESTAMPTZ,
    -- One tenant per connected account and vice versa. Also the index the
    -- account.updated webhook uses to resolve a tenant from an acct_ id,
    -- which is the one lookup on this table that isn't by primary key.
    ADD CONSTRAINT uq_tenants_stripe_account UNIQUE (stripe_account_id);

ALTER TABLE payments
    -- The connected account the PaymentIntent lives on. Required to retrieve
    -- or cancel it later (a direct-charge intent is invisible to a plain
    -- platform-scoped API call), and checked against the webhook event's own
    -- `account` field so an event from another connected account can never
    -- settle this row.
    ADD COLUMN stripe_account_id     VARCHAR(255),
    -- Platform commission taken off this charge, in cents. Stored per payment
    -- rather than recomputed from the tenant's plan: the plan can change, and
    -- what was actually charged is a historical fact.
    ADD COLUMN application_fee_cents INTEGER NOT NULL DEFAULT 0;
