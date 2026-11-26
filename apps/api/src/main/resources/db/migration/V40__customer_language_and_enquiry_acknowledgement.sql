-- Which language a Customer reads, and whether a studio sends the automatic
-- enquiry acknowledgement.
--
-- Customer messages (the messaging module) are written in the Customer's
-- language. There is no single Customer record yet, so the language sits on
-- each row a Customer exists as: the lead, the inquiry request and the booking.
-- Converting one into a booking carries it over. Existing rows and rows
-- entered by hand get 'de': the studios and almost all their Customers are
-- German.
--
-- Lowercase ISO 639-1 codes, matching the web app's locales; the CHECK keeps
-- the closed set in the database as well as in CustomerLanguage, as V37 does
-- for revenue source.
--
-- No new table, so no GRANT and no RLS policy here: leads, inquiry_requests,
-- bookings and tenants already have both, and an added column inherits them
-- (see V36__grant_and_secure_contracts_and_interest.sql for the template a new
-- table would need).

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS language VARCHAR(2) NOT NULL DEFAULT 'de'
        CONSTRAINT leads_language_check CHECK (language IN ('de', 'en'));

ALTER TABLE inquiry_requests
    ADD COLUMN IF NOT EXISTS language VARCHAR(2) NOT NULL DEFAULT 'de'
        CONSTRAINT inquiry_requests_language_check CHECK (language IN ('de', 'en'));

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS language VARCHAR(2) NOT NULL DEFAULT 'de'
        CONSTRAINT bookings_language_check CHECK (language IN ('de', 'en'));

-- On by default: a Customer who sends an enquiry should hear that it arrived.
-- A studio that answers every enquiry personally switches it off.
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS enquiry_acknowledgement_enabled BOOLEAN NOT NULL DEFAULT TRUE;
