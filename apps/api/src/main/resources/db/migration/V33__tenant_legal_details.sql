-- Per-photographer legal identity, required to publish a public page in Germany.
--
-- §5 DDG (the former §5 TMG) obliges every commercial online presence to carry
-- its own Impressum, and Art. 13 GDPR obliges a privacy notice at the point
-- personal data is collected. Both duties fall on the *photographer* — they are
-- the data controller for their clients' enquiries, not the platform — so the
-- details cannot live in the platform-wide legal pages under apps/web. Each
-- tenant's public portfolio and request form must show the photographer's own.
--
-- Everything is nullable: existing tenants predate these columns and a
-- registration cannot demand a VAT id before the photographer has told us
-- whether they have one. Completeness is enforced in the service layer
-- (TenantLegalService.isComplete), which is what gates publishing a public page,
-- rather than by NOT NULL constraints that would break registration.
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS legal_name          VARCHAR(200),
    ADD COLUMN IF NOT EXISTS legal_street        VARCHAR(200),
    ADD COLUMN IF NOT EXISTS legal_postal_code   VARCHAR(20),
    ADD COLUMN IF NOT EXISTS legal_city          VARCHAR(120),
    ADD COLUMN IF NOT EXISTS legal_country       VARCHAR(80) DEFAULT 'Deutschland',
    ADD COLUMN IF NOT EXISTS legal_email         VARCHAR(320),
    ADD COLUMN IF NOT EXISTS legal_phone         VARCHAR(50),
    -- Conditional under §27a UStG / §5 DDG: present only if the photographer is
    -- VAT-registered or entered in the commercial register. A Kleinunternehmer
    -- (§19 UStG) legitimately has neither.
    ADD COLUMN IF NOT EXISTS legal_vat_id        VARCHAR(50),
    ADD COLUMN IF NOT EXISTS legal_register      VARCHAR(200),
    -- §18 Abs. 2 MStV: person responsible for editorial content. Falls back to
    -- legal_name when the photographer is a sole trader, which is the norm here.
    ADD COLUMN IF NOT EXISTS legal_responsible   VARCHAR(200),
    -- Art. 13(1)(b) GDPR contact for data-protection matters. Falls back to
    -- legal_email; a separate address only matters once a DPO is appointed.
    ADD COLUMN IF NOT EXISTS privacy_contact_email VARCHAR(320);
