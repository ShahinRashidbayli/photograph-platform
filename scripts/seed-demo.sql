-- ============================================================================
-- Demo data for the local development database.
--
-- Fills one tenant with enough variety to *see* every state the product can be
-- in: each booking status, each lead score and status, galleries that are
-- live / expiring / expired / purged, invoices paid, part-paid, unpaid and
-- cancelled, and clients that land in each of the directory's filters.
--
-- Run it with:
--     make seed
--
-- DEVELOPMENT ONLY. It deletes and rewrites the tenant's operational rows, and
-- it truncates the invoice tables (see the note further down). The guards at
-- the top refuse to run anywhere that does not look like the local Docker
-- database, because "seed the dev box" and "wipe a real studio's invoices" are
-- one typo apart.
--
-- Safe to re-run: every insert is preceded by a delete of what it inserts, so
-- the result is the same set of rows rather than a growing pile of duplicates.
-- ============================================================================

\set ON_ERROR_STOP on

-- Target tenant. Override with:  make seed SUBDOMAIN=<your-subdomain>
\if :{?subdomain}
\else
\set subdomain 'shahinrashidbayli'
\endif

DO $$
BEGIN
    -- Guard 1: the local compose database is called `centralidp`. A staging or
    -- production URL will not be.
    IF current_database() <> 'centralidp' THEN
        RAISE EXCEPTION
            'Refusing to seed: expected database "centralidp", got "%". '
            'This script is for the local Docker database only.', current_database();
    END IF;

    -- Guard 2: more than a handful of tenants means this is not a dev box.
    IF (SELECT count(*) FROM tenants) > 20 THEN
        RAISE EXCEPTION
            'Refusing to seed: % tenants present. That does not look like a '
            'development database.', (SELECT count(*) FROM tenants);
    END IF;
END $$;

BEGIN;

-- ── Who are we seeding? ─────────────────────────────────────────────────────
-- The photographer whose dashboard you are looking at. Resolved by subdomain
-- rather than hard-coded id so a rebuilt database still works.
-- Session-scoped, not ON COMMIT DROP: the summary below runs after COMMIT.
DROP TABLE IF EXISTS seed_target;
CREATE TEMP TABLE seed_target AS
SELECT t.id AS tenant_id
FROM tenants t
WHERE t.subdomain = :'subdomain';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM seed_target) THEN
        RAISE EXCEPTION
            'No tenant with that subdomain. Register in the app first, then '
            're-run with:  make seed SUBDOMAIN=<your-subdomain>';
    END IF;
END $$;

-- ── Clear what we are about to write ────────────────────────────────────────
-- Leaf-to-root, so foreign keys are satisfied without relying on cascades.
DELETE FROM delivery_photos WHERE gallery_id IN (
    SELECT g.id FROM galleries g JOIN seed_target s ON g.tenant_id = s.tenant_id);
DELETE FROM gallery_expiry_reminders WHERE gallery_id IN (
    SELECT g.id FROM galleries g JOIN seed_target s ON g.tenant_id = s.tenant_id);
DELETE FROM galleries USING seed_target s WHERE galleries.tenant_id = s.tenant_id;

-- Invoices refuse DELETE: trg_invoices_immutable (V13) enforces GoBD
-- append-only bookkeeping, and that block applies to every role including a
-- superuser. TRUNCATE only fires statement-level triggers, which these tables
-- do not have, so it is the one way to clear them — at the cost of taking
-- every tenant's invoices with it. Acceptable on a dev box that only holds
-- test tenants, and the guards above are what keep it there.
TRUNCATE payments, invoice_line_items, invoices, invoice_counters CASCADE;

DELETE FROM bookings   USING seed_target s WHERE bookings.tenant_id   = s.tenant_id;
DELETE FROM clients    USING seed_target s WHERE clients.tenant_id    = s.tenant_id;
DELETE FROM client_notes USING seed_target s WHERE client_notes.tenant_id = s.tenant_id;
DELETE FROM leads      USING seed_target s WHERE leads.tenant_id      = s.tenant_id;
DELETE FROM packages   USING seed_target s WHERE packages.tenant_id   = s.tenant_id;
DELETE FROM inquiry_requests USING seed_target s WHERE inquiry_requests.tenant_id = s.tenant_id;

-- ── Studio identity ─────────────────────────────────────────────────────────
-- The name the product presents as the photographer's own. `business_name` is
-- what `DeliveryPhotoProcessor.watermarkLabel()` reads first; with it unset the
-- label fell through to the owner's full name and then to the subdomain, so a
-- watermarked gallery tiled the developer's personal name across a client's
-- wedding photos on every dev box that ran this script.
--
-- Left NULL on the real signup path on purpose — a photographer's watermark
-- must be their studio, never ours. This is seed data for a demo tenant, so
-- here it is simply the demo studio's name.
UPDATE tenants t
SET business_name = 'Fotolio'
FROM seed_target s
WHERE t.id = s.tenant_id
  AND (t.business_name IS NULL OR t.business_name = '');

-- ── Packages ────────────────────────────────────────────────────────────────
INSERT INTO packages (id, tenant_id, name, price_cents, duration_hours, included_photos, is_active, sort_order)
SELECT p.id, s.tenant_id, p.name, p.price_cents, p.hours, p.photos, p.active, p.sort
FROM seed_target s, (VALUES
    ('11111111-0000-4000-a000-000000000001'::uuid, 'Standesamt kompakt',  49000,  2.0,  60, true,  1),
    ('11111111-0000-4000-a000-000000000002'::uuid, 'Hochzeit Klassik',   149000,  8.0, 400, true,  2),
    ('11111111-0000-4000-a000-000000000003'::uuid, 'Hochzeit Premium',   239000, 12.0, 800, true,  3),
    ('11111111-0000-4000-a000-000000000004'::uuid, 'Familienshooting',    39000,  1.5,  40, true,  4),
    ('11111111-0000-4000-a000-000000000005'::uuid, 'Business Portrait',   29000,  1.0,  15, true,  5),
    ('11111111-0000-4000-a000-000000000006'::uuid, 'Newborn (2024)',      35000,  2.0,  30, false, 6)
) AS p(id, name, price_cents, hours, photos, active, sort);

-- ── Client notes ────────────────────────────────────────────────────────────
-- The client directory is derived from the bookings below (V40): one client
-- per address, with their counts, upcoming sessions and spend computed on
-- read. The only thing it stores is the photographer's notes, keyed by the
-- client's normalised address. The bookings are chosen so the directory's
-- three filters all have something to show:
--   Active — has a future booking that is not COMPLETED/CANCELLED/DECLINED
--   Repeat — more than one booking that is happening
--   neither — past-only, or a single cancelled booking
INSERT INTO client_notes (tenant_id, email, notes)
SELECT s.tenant_id, n.email, n.notes
FROM seed_target s, (VALUES
    ('maria.kellner@web.de',      'Zweite Hochzeit in der Familie — Schwester heiratet 2027, Kontakt halten.'),
    ('j.hoffmann@gmx.de',         'Möchte unbedingt Available Light, kein Blitz in der Kirche.'),
    ('familie.bauer@t-online.de', 'Jedes Jahr im Herbst — Erinnerung im August schicken.'),
    ('lena.schulz@posteo.de',     'Hat kurzfristig abgesagt, war aber sehr freundlich — nicht abschreiben.'),
    ('sandra.klein@web.de',       'Verschoben auf 2027 wegen Bauverzögerung in der Location.')
) AS n(email, notes);

-- ── Bookings ────────────────────────────────────────────────────────────────
-- Every status the schema allows, spread across past and future so the
-- calendar, the "upcoming" counts and the revenue figures all have something
-- to work with.
INSERT INTO bookings (id, tenant_id, client_name, client_email, event_date, event_time,
                      event_type, location, package_id, total_amount_cents, deposit_amount_cents,
                      status, internal_notes, created_at, updated_at)
SELECT b.id, s.tenant_id, b.name, b.email, b.event_date, b.event_time,
       b.event_type, b.location, b.package_id, b.total, b.deposit, b.status, b.notes,
       now() - b.age, now() - b.age
FROM seed_target s, (VALUES
    -- Upcoming, confirmed and paid up
    ('33333333-0000-4000-a000-000000000001'::uuid, '22222222-0000-4000-a000-000000000001'::uuid,
     'Maria Kellner', 'maria.kellner@web.de', CURRENT_DATE + 21, TIME '11:00',
     'Hochzeit', 'Schloss Broich, Mülheim an der Ruhr', '11111111-0000-4000-a000-000000000003'::uuid,
     239000, 60000, 'CONFIRMED', 'Trauung 11:00, Sektempfang im Innenhof. Zweitfotograf gebucht.', INTERVAL '60 days'),
    -- Upcoming, confirmed, deposit only
    ('33333333-0000-4000-a000-000000000002'::uuid, '22222222-0000-4000-a000-000000000002'::uuid,
     'Julia Hoffmann', 'j.hoffmann@gmx.de', CURRENT_DATE + 62, TIME '14:30',
     'Hochzeit', 'St. Mariä Himmelfahrt, Köln', '11111111-0000-4000-a000-000000000002'::uuid,
     149000, 40000, 'CONFIRMED', 'Kirche erlaubt keinen Blitz — 35mm f/1.4 einpacken.', INTERVAL '30 days'),
    -- Upcoming, still an enquiry
    ('33333333-0000-4000-a000-000000000003'::uuid, '22222222-0000-4000-a000-000000000006'::uuid,
     'Paul Neumann', 'p.neumann@mail.de', CURRENT_DATE + 40, TIME '10:00',
     'Portrait', 'Studio', '11111111-0000-4000-a000-000000000005'::uuid,
     29000, 0, 'ENQUIRY', 'Bewerbungsfotos, fragt nach Express-Bearbeitung.', INTERVAL '6 days'),
    -- Upcoming, business shoot in a week
    ('33333333-0000-4000-a000-000000000004'::uuid, '22222222-0000-4000-a000-000000000008'::uuid,
     'Michael Fischer', 'm.fischer@gmail.com', CURRENT_DATE + 7, TIME '09:00',
     'Business', 'Bürogebäude Ruhrallee, Essen', '11111111-0000-4000-a000-000000000005'::uuid,
     29000, 29000, 'CONFIRMED', 'Ganzes Team, ca. 14 Personen. Grauer Hintergrund mitbringen.', INTERVAL '20 days'),
    -- Postponed to next year
    ('33333333-0000-4000-a000-000000000005'::uuid, '22222222-0000-4000-a000-000000000007'::uuid,
     'Sandra Klein', 'sandra.klein@web.de', CURRENT_DATE + 200, TIME '13:00',
     'Hochzeit', 'Gut Höhne, Mettmann', '11111111-0000-4000-a000-000000000002'::uuid,
     149000, 30000, 'POSTPONED', 'Location-Umbau verzögert sich. Neuer Termin bestätigt.', INTERVAL '210 days'),
    -- Completed, delivered, fully paid
    ('33333333-0000-4000-a000-000000000006'::uuid, '22222222-0000-4000-a000-000000000001'::uuid,
     'Maria Kellner', 'maria.kellner@web.de', CURRENT_DATE - 90, TIME '15:00',
     'Hochzeit', 'Villa Vue, Düsseldorf', '11111111-0000-4000-a000-000000000002'::uuid,
     149000, 40000, 'COMPLETED', 'Galerie geliefert, Kundin sehr zufrieden.', INTERVAL '300 days'),
    -- Completed family session
    ('33333333-0000-4000-a000-000000000007'::uuid, '22222222-0000-4000-a000-000000000003'::uuid,
     'Familie Bauer', 'familie.bauer@t-online.de', CURRENT_DATE - 30, TIME '16:00',
     'Familie', 'Stadtwald, Essen', '11111111-0000-4000-a000-000000000004'::uuid,
     39000, 0, 'COMPLETED', 'Herbstlicht, goldene Stunde. Wie jedes Jahr.', INTERVAL '60 days'),
    -- Completed business portrait, invoice still open
    ('33333333-0000-4000-a000-000000000008'::uuid, '22222222-0000-4000-a000-000000000004'::uuid,
     'Thomas Wagner', 'thomas.wagner@outlook.de', CURRENT_DATE - 120, TIME '11:30',
     'Business', 'Coworking Space, Bochum', '11111111-0000-4000-a000-000000000005'::uuid,
     29000, 0, 'COMPLETED', 'Rechnung offen — zweite Erinnerung raus.', INTERVAL '140 days'),
    -- Cancelled by the client
    ('33333333-0000-4000-a000-000000000009'::uuid, '22222222-0000-4000-a000-000000000005'::uuid,
     'Lena Schulz', 'lena.schulz@posteo.de', CURRENT_DATE - 45, TIME '12:00',
     'Hochzeit', 'Standesamt Mülheim', '11111111-0000-4000-a000-000000000001'::uuid,
     49000, 0, 'CANCELLED', 'Kurzfristig abgesagt, Anzahlung war noch nicht fällig.', INTERVAL '80 days'),
    -- Declined enquiry — date was already taken
    ('33333333-0000-4000-a00a-00000000000a'::uuid, NULL,
     'Nina Vogel', 'nina.vogel@web.de', CURRENT_DATE + 21, TIME '12:00',
     'Hochzeit', 'Zeche Zollverein, Essen', NULL,
     0, 0, 'DECLINED', 'Termin doppelt angefragt — Maria Kellner war zuerst.', INTERVAL '55 days'),
    -- Older completed sessions, so the repeat clients have history behind them
    ('33333333-0000-4000-a00b-00000000000b'::uuid, '22222222-0000-4000-a000-000000000003'::uuid,
     'Familie Bauer', 'familie.bauer@t-online.de', CURRENT_DATE - 400, TIME '16:00',
     'Familie', 'Stadtwald, Essen', '11111111-0000-4000-a000-000000000004'::uuid,
     39000, 0, 'COMPLETED', NULL, INTERVAL '430 days'),
    ('33333333-0000-4000-a00c-00000000000c'::uuid, '22222222-0000-4000-a000-000000000008'::uuid,
     'Michael Fischer', 'm.fischer@gmail.com', CURRENT_DATE - 240, TIME '09:30',
     'Business', 'Bürogebäude Ruhrallee, Essen', '11111111-0000-4000-a000-000000000005'::uuid,
     29000, 0, 'COMPLETED', NULL, INTERVAL '260 days')
    ,
    -- Deeper history, so the repeat clients genuinely have the totals the
    -- directory shows them with. Without these, every client topped out at two
    -- bookings and "Repeat" was a filter with nothing distinctive behind it.
    ('33333333-0000-4000-a00d-00000000000d'::uuid, '22222222-0000-4000-a000-000000000001'::uuid,
     'Maria Kellner', 'maria.kellner@web.de', CURRENT_DATE - 620, TIME '14:00',
     'Verlobung', 'Baldeneysee, Essen', '11111111-0000-4000-a000-000000000004'::uuid,
     39000, 0, 'COMPLETED', 'Verlobungsshooting — daraus wurde die Hochzeit.', INTERVAL '650 days'),
    ('33333333-0000-4000-a00e-00000000000e'::uuid, '22222222-0000-4000-a000-000000000003'::uuid,
     'Familie Bauer', 'familie.bauer@t-online.de', CURRENT_DATE - 760, TIME '15:30',
     'Familie', 'Stadtwald, Essen', '11111111-0000-4000-a000-000000000004'::uuid,
     39000, 0, 'COMPLETED', NULL, INTERVAL '790 days'),
    ('33333333-0000-4000-a00f-00000000000f'::uuid, '22222222-0000-4000-a000-000000000003'::uuid,
     'Familie Bauer', 'familie.bauer@t-online.de', CURRENT_DATE - 1120, TIME '15:30',
     'Familie', 'Botanischer Garten, Bochum', '11111111-0000-4000-a000-000000000004'::uuid,
     39000, 0, 'COMPLETED', 'Erstes Shooting — seitdem jedes Jahr.', INTERVAL '1150 days'),
    ('33333333-0000-4000-a010-000000000010'::uuid, '22222222-0000-4000-a000-000000000008'::uuid,
     'Michael Fischer', 'm.fischer@gmail.com', CURRENT_DATE - 480, TIME '10:00',
     'Business', 'Messe Essen', '11111111-0000-4000-a000-000000000005'::uuid,
     29000, 0, 'COMPLETED', 'Messestand, zwei Tage.', INTERVAL '500 days'),
    ('33333333-0000-4000-a011-000000000011'::uuid, '22222222-0000-4000-a000-000000000008'::uuid,
     'Michael Fischer', 'm.fischer@gmail.com', CURRENT_DATE - 700, TIME '09:00',
     'Business', 'Bürogebäude Ruhrallee, Essen', '11111111-0000-4000-a000-000000000005'::uuid,
     29000, 0, 'COMPLETED', NULL, INTERVAL '720 days')
) AS b(id, client_id, name, email, event_date, event_time, event_type, location,
       package_id, total, deposit, status, notes, age);

-- ── Leads ───────────────────────────────────────────────────────────────────
-- Every status × a spread of scores, so the inbox, the badge count and the
-- score colours all have something to show. NEW ones drive the sidebar badge.
INSERT INTO leads (id, tenant_id, name, email, phone, event_date, event_type,
                   budget_range, message, internal_notes, score, status, source, created_at)
SELECT l.id, s.tenant_id, l.name, l.email, l.phone, l.event_date, l.event_type,
       l.budget, l.message, l.notes, l.score, l.status, l.source, now() - l.age
FROM seed_target s, (VALUES
    ('44444444-0000-4000-a000-000000000001'::uuid, 'Katharina Berg', 'k.berg@web.de', '+49 170 3332211',
     CURRENT_DATE + 300, 'WEDDING', 'OVER_1000',
     'Hallo! Wir heiraten im Juni 2027 auf Gut Höhne und suchen noch jemanden für den ganzen Tag. Ihr Portfolio gefällt uns sehr!',
     NULL, 'HIGH', 'NEW', 'WEBSITE', INTERVAL '2 hours'),
    ('44444444-0000-4000-a000-000000000002'::uuid, 'Tobias Reuter', 'tobias.r@gmail.com', NULL,
     CURRENT_DATE + 120, 'CORPORATE', '500_1000',
     'Brauchen neue Teamfotos für die Website, ca. 20 Personen.',
     NULL, 'MED', 'NEW', 'INSTAGRAM', INTERVAL '1 day'),
    -- Deliberately dateless: `leads.event_date` is nullable and the urgency
    -- chip used to call `.getTime()` on it. Keep at least one of these.
    ('44444444-0000-4000-a000-000000000003'::uuid, 'Anonym', 'kein.budget@example.com', NULL,
     NULL, NULL, NULL,
     'Was kostet das denn so ungefähr?',
     NULL, 'LOW', 'NEW', 'INSTAGRAM', INTERVAL '3 days'),
    ('44444444-0000-4000-a000-000000000004'::uuid, 'Sophie Lang', 'sophie.lang@posteo.de', '+49 151 7778899',
     CURRENT_DATE + 180, 'WEDDING', 'OVER_1000',
     'Freie Trauung am Baldeneysee, ca. 80 Gäste. Wir hätten gern auch eine Drohne.',
     'Angebot mit Premium-Paket geschickt, wartet auf Rückmeldung vom Partner.',
     'HIGH', 'REPLIED', 'REFERRAL', INTERVAL '6 days'),
    ('44444444-0000-4000-a000-000000000005'::uuid, 'Marco Peters', 'm.peters@web.de', '+49 176 1112233',
     CURRENT_DATE + 55, 'FAMILY', 'UNDER_200',
     'Kleines Shooting mit zwei Kindern, gern draußen.',
     'Termin angeboten, noch keine Antwort.', 'MED', 'REPLIED', 'WEBSITE', INTERVAL '11 days'),
    ('44444444-0000-4000-a000-000000000006'::uuid, 'Julia Hoffmann', 'j.hoffmann@gmx.de', '+49 151 9876543',
     CURRENT_DATE + 62, 'WEDDING', 'OVER_1000',
     'Kirchliche Trauung in Köln, danach Feier im Garten.',
     'Gebucht — Klassik-Paket, Anzahlung erhalten.', 'HIGH', 'BOOKED', 'INSTAGRAM', INTERVAL '35 days'),
    ('44444444-0000-4000-a000-000000000007'::uuid, 'Unbekannt', 'spam@example.com', NULL,
     NULL, NULL, NULL,
     'SEO SERVICES BEST PRICE CONTACT US NOW',
     'Spam.', 'LOW', 'REJECTED', 'WEBSITE', INTERVAL '15 days'),
    ('44444444-0000-4000-a000-000000000008'::uuid, 'Daniel Krause', 'd.krause@mail.de', NULL,
     CURRENT_DATE + 21, 'WEDDING', 'OVER_1000',
     'Termin am 21. — geht das noch?',
     'Abgelehnt, Termin war schon vergeben.', 'MED', 'REJECTED', 'WEBSITE', INTERVAL '50 days')
) AS l(id, name, email, phone, event_date, event_type, budget, message, notes, score, status, source, age);

-- ── Galleries ───────────────────────────────────────────────────────────────
-- The retention states side by side (ADR-001): comfortably live, about to
-- expire, expired but inside the recoverable grace window, and purged.
INSERT INTO galleries (id, tenant_id, booking_id, access_token, expires_at, download_enabled,
                       watermark_enabled, view_count, created_at, delivered_at, retention_days,
                       expiry_state, soft_deleted_at, purge_after, extension_count)
SELECT g.id, s.tenant_id, g.booking_id, g.token, g.expires_at, g.download, g.watermark,
       g.views, now() - g.age, g.delivered, g.retention, g.state, g.soft_deleted, g.purge_after, g.extensions
FROM seed_target s, (VALUES
    -- Live, plenty of time left, downloads on
    ('55555555-0000-4000-a000-000000000001'::uuid, '33333333-0000-4000-a000-000000000006'::uuid,
     'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888',
     now() + INTERVAL '52 days', true, false, 34, INTERVAL '8 days', now() - INTERVAL '8 days',
     60, 'ACTIVE', NULL, NULL, 0),
    -- Live but nearly out of time — this is the one that should look urgent
    ('55555555-0000-4000-a000-000000000002'::uuid, '33333333-0000-4000-a000-000000000007'::uuid,
     'bbbb1111cccc2222dddd3333eeee4444ffff5555aaaa6666bbbb7777cccc8888',
     now() + INTERVAL '4 days', true, true, 112, INTERVAL '56 days', now() - INTERVAL '56 days',
     60, 'ACTIVE', NULL, NULL, 1),
    -- Watermarked, downloads off — the locked-down combination
    ('55555555-0000-4000-a000-000000000003'::uuid, '33333333-0000-4000-a000-000000000008'::uuid,
     'cccc1111dddd2222eeee3333ffff4444aaaa5555bbbb6666cccc7777dddd8888',
     now() + INTERVAL '30 days', false, true, 3, INTERVAL '30 days', now() - INTERVAL '30 days',
     60, 'ACTIVE', NULL, NULL, 0),
    -- Expired, still inside the grace period, so Extend can still save it
    ('55555555-0000-4000-a000-000000000004'::uuid, '33333333-0000-4000-a00b-00000000000b'::uuid,
     'dddd1111eeee2222ffff3333aaaa4444bbbb5555cccc6666dddd7777eeee8888',
     now() - INTERVAL '9 days', true, false, 78, INTERVAL '70 days', now() - INTERVAL '70 days',
     60, 'EXPIRED', now() - INTERVAL '9 days', now() + INTERVAL '21 days', 0),
    -- Purged: the grace window ran out and the photos are gone
    ('55555555-0000-4000-a000-000000000005'::uuid, '33333333-0000-4000-a00c-00000000000c'::uuid,
     'eeee1111ffff2222aaaa3333bbbb4444cccc5555dddd6666eeee7777ffff8888',
     now() - INTERVAL '95 days', true, false, 41, INTERVAL '250 days', now() - INTERVAL '250 days',
     60, 'PURGED', now() - INTERVAL '95 days', now() - INTERVAL '65 days', 0),
    -- Never delivered: created for an upcoming shoot, nothing uploaded yet
    ('55555555-0000-4000-a000-000000000006'::uuid, '33333333-0000-4000-a000-000000000001'::uuid,
     'ffff1111aaaa2222bbbb3333cccc4444dddd5555eeee6666ffff7777aaaa8888',
     now() + INTERVAL '60 days', true, false, 0, INTERVAL '2 days', NULL,
     60, 'ACTIVE', NULL, NULL, 0)
) AS g(id, booking_id, token, expires_at, download, watermark, views, age, delivered,
       retention, state, soft_deleted, purge_after, extensions);

-- ── Invoices ────────────────────────────────────────────────────────────────
-- Paid in full, part-paid, unpaid and overdue, plus a cancellation pair
-- (Storno) — the four shapes the invoice list has to render differently.
INSERT INTO invoice_counters (tenant_id, issue_year, next_number)
SELECT s.tenant_id, EXTRACT(YEAR FROM CURRENT_DATE)::int, 6 FROM seed_target s;

INSERT INTO invoices (id, tenant_id, booking_id, invoice_number, issue_year, sequence_number,
                      status, tax_mode, issuer_business_name, issuer_address_line1,
                      issuer_postal_code, issuer_city, issuer_country, issuer_tax_id,
                      buyer_name, buyer_email, buyer_address_line1, buyer_postal_code, buyer_city,
                      buyer_country, payment_terms, currency, subtotal_cents, tax_cents,
                      total_cents, storno_of_id, issued_at, created_at)
SELECT i.id, s.tenant_id, i.booking_id, EXTRACT(YEAR FROM CURRENT_DATE)::int || '-' || lpad(i.seq::text, 4, '0'),
       EXTRACT(YEAR FROM CURRENT_DATE)::int, i.seq,
       i.status, 'KLEINUNTERNEHMER', 'Fotografie Shahin Rashidbayli', 'Aktienstraße 12',
       '45473', 'Mülheim an der Ruhr', 'DE', 'DE123456789',
       i.buyer_name, i.buyer_email, i.buyer_addr, i.buyer_zip, i.buyer_city,
       'DE', 'Zahlbar innerhalb von 14 Tagen ohne Abzug.', 'EUR', i.total, 0,
       i.total, i.storno_of, now() - i.age, now() - i.age
FROM seed_target s, (VALUES
    -- Paid in full
    ('66666666-0000-4000-a000-000000000001'::uuid, '33333333-0000-4000-a000-000000000006'::uuid,
     1, 'ISSUED', 'Maria Kellner', 'maria.kellner@web.de',
     'Kaiserstraße 44', '45468', 'Mülheim an der Ruhr', 149000, NULL, INTERVAL '88 days'),
    -- Part paid: deposit received, balance outstanding
    ('66666666-0000-4000-a000-000000000002'::uuid, '33333333-0000-4000-a000-000000000001'::uuid,
     2, 'ISSUED', 'Maria Kellner', 'maria.kellner@web.de',
     'Kaiserstraße 44', '45468', 'Mülheim an der Ruhr', 239000, NULL, INTERVAL '40 days'),
    -- Unpaid and well past its terms
    ('66666666-0000-4000-a000-000000000003'::uuid, '33333333-0000-4000-a000-000000000008'::uuid,
     3, 'ISSUED', 'Thomas Wagner', 'thomas.wagner@outlook.de',
     'Hattinger Straße 9', '44789', 'Bochum', 29000, NULL, INTERVAL '110 days'),
    -- Cancelled, and the credit note that cancels it
    ('66666666-0000-4000-a000-000000000004'::uuid, '33333333-0000-4000-a000-000000000009'::uuid,
     4, 'STORNIERT', 'Lena Schulz', 'lena.schulz@posteo.de',
     'Delle 3', '45468', 'Mülheim an der Ruhr', 49000, NULL, INTERVAL '70 days'),
    ('66666666-0000-4000-a000-000000000005'::uuid, '33333333-0000-4000-a000-000000000009'::uuid,
     5, 'ISSUED', 'Lena Schulz', 'lena.schulz@posteo.de',
     'Delle 3', '45468', 'Mülheim an der Ruhr', -49000,
     '66666666-0000-4000-a000-000000000004'::uuid, INTERVAL '69 days')
) AS i(id, booking_id, seq, status, buyer_name, buyer_email, buyer_addr,
       buyer_zip, buyer_city, total, storno_of, age);

INSERT INTO invoice_line_items (tenant_id, invoice_id, description, quantity, unit_price_cents,
                                tax_category, tax_rate_percent, line_total_cents, sort_order)
SELECT s.tenant_id, li.invoice_id, li.description, 1, li.amount, 'STANDARD', 0, li.amount, 1
FROM seed_target s, (VALUES
    ('66666666-0000-4000-a000-000000000001'::uuid, 'Hochzeitsreportage Klassik — 8 Stunden', 149000),
    ('66666666-0000-4000-a000-000000000002'::uuid, 'Hochzeitsreportage Premium — 12 Stunden', 239000),
    ('66666666-0000-4000-a000-000000000003'::uuid, 'Business Portrait — Einzelshooting', 29000),
    ('66666666-0000-4000-a000-000000000004'::uuid, 'Standesamt kompakt — 2 Stunden', 49000),
    ('66666666-0000-4000-a000-000000000005'::uuid, 'Storno zur vorherigen Rechnung', -49000)
) AS li(invoice_id, description, amount);

-- ── Payments ────────────────────────────────────────────────────────────────
-- Succeeded, pending and failed, across all three methods.
INSERT INTO payments (tenant_id, invoice_id, method, status, amount_cents, currency,
                      stripe_payment_intent_id, confirmed_at, created_at, updated_at)
SELECT s.tenant_id, p.invoice_id, p.method, p.status, p.amount, 'EUR',
       p.intent, p.confirmed, now() - p.age, now() - p.age
FROM seed_target s, (VALUES
    -- Invoice 1 settled in two instalments
    ('66666666-0000-4000-a000-000000000001'::uuid, 'UEBERWEISUNG', 'SUCCEEDED', 40000,
     NULL, now() - INTERVAL '85 days', INTERVAL '85 days'),
    ('66666666-0000-4000-a000-000000000001'::uuid, 'UEBERWEISUNG', 'SUCCEEDED', 109000,
     NULL, now() - INTERVAL '80 days', INTERVAL '80 days'),
    -- Invoice 2: deposit only, the rest is still open
    ('66666666-0000-4000-a000-000000000002'::uuid, 'CARD', 'SUCCEEDED', 60000,
     'pi_seed_demo_deposit_0002', now() - INTERVAL '38 days', INTERVAL '38 days'),
    -- A card that never completed, and a retry still in flight
    ('66666666-0000-4000-a000-000000000003'::uuid, 'CARD', 'FAILED', 29000,
     'pi_seed_demo_failed_0003', NULL, INTERVAL '30 days'),
    ('66666666-0000-4000-a000-000000000003'::uuid, 'SEPA', 'PENDING', 29000,
     'pi_seed_demo_pending_0003', NULL, INTERVAL '2 days')
) AS p(invoice_id, method, status, amount, intent, confirmed, age);

-- ── Client enquiries from the bio link ──────────────────────────────────────
-- Needs an existing CUSTOMER user, since `customer_id` is a FK to users. The
-- tenant already has a few from magic-link sign-ins; skipped when it has none
-- rather than inventing accounts that could collide with a real sign-in.
INSERT INTO inquiry_requests (tenant_id, customer_id, event_type, budget_range, proposed_date,
                              location, message, score, status, source, created_at, updated_at)
SELECT s.tenant_id, u.id, q.event_type, q.budget, CURRENT_DATE + q.in_days,
       q.location, q.message, q.score, q.status, 'BIO_LINK', now() - q.age, now() - q.age
FROM seed_target s
JOIN LATERAL (
    -- `users` has no created_at; ordering by email just makes the pick
    -- deterministic across re-runs.
    SELECT usr.id FROM users usr
    WHERE usr.tenant_id = s.tenant_id AND usr.role = 'CUSTOMER'
    ORDER BY usr.email LIMIT 1
) u ON true,
(VALUES
    ('HOCHZEIT', 'OVER_2000', 240, 'Schloss Hugenpoet, Essen',
     'Wir haben Sie über Instagram gefunden und würden gern für 2027 anfragen.',
     'HIGH', 'PENDING', INTERVAL '5 hours'),
    ('FAMILIE', 'UNDER_500', 30, 'Zuhause, Duisburg',
     'Ein kurzes Shooting mit Oma und den Enkelkindern.',
     'MED', 'ACCEPTED', INTERVAL '9 days'),
    ('EVENT', '500_1000', 90, 'Büro Düsseldorf',
     'Headshots für sechs neue Kolleginnen.',
     'LOW', 'REJECTED', INTERVAL '20 days')
) AS q(event_type, budget, in_days, location, message, score, status, age);

COMMIT;

-- ── What landed ─────────────────────────────────────────────────────────────
SELECT 'clients'   AS table_name, count(DISTINCT lower(client_email)) FROM bookings WHERE tenant_id = (SELECT tenant_id FROM seed_target)
UNION ALL SELECT 'bookings',  count(*) FROM bookings  WHERE tenant_id = (SELECT tenant_id FROM seed_target)
UNION ALL SELECT 'leads',     count(*) FROM leads     WHERE tenant_id = (SELECT tenant_id FROM seed_target)
UNION ALL SELECT 'galleries', count(*) FROM galleries WHERE tenant_id = (SELECT tenant_id FROM seed_target)
UNION ALL SELECT 'invoices',  count(*) FROM invoices  WHERE tenant_id = (SELECT tenant_id FROM seed_target)
UNION ALL SELECT 'payments',  count(*) FROM payments  WHERE tenant_id = (SELECT tenant_id FROM seed_target)
UNION ALL SELECT 'packages',  count(*) FROM packages  WHERE tenant_id = (SELECT tenant_id FROM seed_target)
UNION ALL SELECT 'inquiries', count(*) FROM inquiry_requests WHERE tenant_id = (SELECT tenant_id FROM seed_target);
