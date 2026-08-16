-- Legal/billing profile fields needed on the invoice issuer (§14 UStG requires
-- the issuer's full name, address, and tax ID on every invoice). Nullable —
-- there's no onboarding step collecting these yet (spec F10), so a tenant can
-- register and use the rest of the product before filling them in; InvoiceService
-- refuses to issue an invoice until they're present (see InvoiceService.issue).
ALTER TABLE tenants
    ADD COLUMN business_name VARCHAR(200),
    ADD COLUMN address_line1 VARCHAR(200),
    ADD COLUMN address_line2 VARCHAR(200),
    ADD COLUMN postal_code   VARCHAR(20),
    ADD COLUMN city          VARCHAR(100),
    ADD COLUMN country       VARCHAR(2)  NOT NULL DEFAULT 'DE',
    ADD COLUMN tax_id        VARCHAR(50),
    ADD COLUMN vat_id        VARCHAR(50),
    ADD COLUMN tax_mode      VARCHAR(20) NOT NULL DEFAULT 'KLEINUNTERNEHMER',
    ADD CONSTRAINT chk_tenants_tax_mode CHECK (tax_mode IN ('KLEINUNTERNEHMER', 'REGELBESTEUERUNG'));

-- schema_name was a GENERATED column left over from the schema-per-tenant
-- design replaced by V11 (RLS). Nothing has read it since that migration —
-- dropping it now rather than leaving a dead, misleading artifact.
ALTER TABLE tenants DROP COLUMN schema_name;
