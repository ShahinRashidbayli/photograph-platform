-- Which language a studio user (owner or staff) uses Fotolio in, and so the
-- language every email Fotolio sends them is written in: Notifications,
-- address verification, password reset, staff invitations they send (#126).
--
-- The web app keeps its language choice on the device; it now also saves it
-- here whenever the user switches. Existing rows get 'de': the studios are
-- German, and German is what the web app shows first.
--
-- Same column shape and closed set as V40's Customer language on leads,
-- inquiry requests and bookings (CustomerLanguage, lowercase ISO 639-1).
--
-- No new table, so no GRANT and no RLS policy: users already has its grants,
-- and an added column inherits them.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS language VARCHAR(2) NOT NULL DEFAULT 'de'
        CONSTRAINT users_language_check CHECK (language IN ('de', 'en'));
