-- White-label branding — the last thing the Studio plan sells and does not do.
--
-- Two columns, because two things actually change what a client sees: the mark
-- at the top of a page, and the colour the page is built around. Everything
-- else a "branding" screen is tempted to offer — fonts, layouts, custom CSS —
-- is a way to make a photographer's own gallery look broken, and none of it is
-- what the pricing table promised.
--
-- Both are null for every tenant, including Studio ones: white-label is
-- something a photographer turns on, not a default that silently strips the
-- platform's name from an account that never asked.

-- The R2 object key, not a URL. Download URLs are pre-signed and expire (see
-- AvatarUrlResolver), so a stored URL is a link that works until it doesn't —
-- which is the bug that convention already exists to prevent.
ALTER TABLE tenants ADD COLUMN logo_key VARCHAR(500);

-- `#RRGGBB`, validated in the API rather than here: a CHECK constraint on a
-- hex string would reject a perfectly good `#FFF` on a migration nobody wants
-- to run again, and the value reaches the database from exactly one endpoint.
--
-- One colour, not a palette. The client-facing surfaces derive their accents
-- from it; letting a studio set text and background independently is how a
-- gallery ends up with grey text on a grey ground, blamed on us.
ALTER TABLE tenants ADD COLUMN brand_color VARCHAR(7);

-- No `hide_platform_branding` column on purpose. Whether "Powered by Fotolio"
-- appears is decided by the plan's WHITE_LABEL_BRANDING capability, which is
-- already served to both the API's gates and the frontend. A column would let
-- the two disagree — a tenant that downgraded keeping the platform's name off
-- pages it no longer pays to have unbranded.
