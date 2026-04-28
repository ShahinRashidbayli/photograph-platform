-- Seed sample tenant data used by dashboard pages.
-- The statements are idempotent so re-running is safe.

-- ─────────────────────────────────────────
--  SUPPORTING CLIENTS
-- ─────────────────────────────────────────
INSERT INTO clients (id, email, full_name, phone, source, created_at)
SELECT '11111111-1111-1111-1111-111111111111', 'maria.klaus@example.com', 'Maria & Klaus', '+49 176 333 2211', 'WEBSITE', now() - interval '30 days'
WHERE NOT EXISTS (
    SELECT 1 FROM clients WHERE id = '11111111-1111-1111-1111-111111111111'
);

INSERT INTO clients (id, email, full_name, phone, source, created_at)
SELECT '22222222-2222-2222-2222-222222222222', 'sophie.richter@example.com', 'Sophie Richter', '+49 162 444 3322', 'INSTAGRAM', now() - interval '20 days'
WHERE NOT EXISTS (
    SELECT 1 FROM clients WHERE id = '22222222-2222-2222-2222-222222222222'
);

INSERT INTO clients (id, email, full_name, phone, source, created_at)
SELECT '33333333-3333-3333-3333-333333333333', 'thomas.mueller@example.com', 'Thomas Muller', '+49 178 555 4433', 'REFERRAL', now() - interval '12 days'
WHERE NOT EXISTS (
    SELECT 1 FROM clients WHERE id = '33333333-3333-3333-3333-333333333333'
);

-- ─────────────────────────────────────────
--  SUPPORTING PACKAGES
-- ─────────────────────────────────────────
INSERT INTO packages (id, name, price_cents, currency, duration_hours, included_photos, is_active, sort_order)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Wedding Essential', 120000, 'EUR', 8.0, 350, true, 1
WHERE NOT EXISTS (
    SELECT 1 FROM packages WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
);

INSERT INTO packages (id, name, price_cents, currency, duration_hours, included_photos, is_active, sort_order)
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Portrait Session', 35000, 'EUR', 2.0, 50, true, 2
WHERE NOT EXISTS (
    SELECT 1 FROM packages WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

INSERT INTO packages (id, name, price_cents, currency, duration_hours, included_photos, is_active, sort_order)
SELECT 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Family Mini', 18000, 'EUR', 1.5, 30, true, 3
WHERE NOT EXISTS (
    SELECT 1 FROM packages WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

-- ─────────────────────────────────────────
--  SAMPLE LEADS
-- ─────────────────────────────────────────
INSERT INTO leads (id, name, email, phone, event_date, event_type, budget_range, message, score, status, ip_address, created_at)
SELECT '44444444-4444-4444-4444-444444444441', 'Laura & Ben', 'laura.ben@example.com', '+49 151 666 5544', current_date + 60, 'ENGAGEMENT', '500_1000', 'Looking for warm documentary-style engagement photos around sunset.', 'HIGH', 'NEW', '203.0.113.11', now() - interval '8 days'
WHERE NOT EXISTS (
    SELECT 1 FROM leads WHERE id = '44444444-4444-4444-4444-444444444441'
);

INSERT INTO leads (id, name, email, phone, event_date, event_type, budget_range, message, score, status, ip_address, created_at)
SELECT '44444444-4444-4444-4444-444444444442', 'Nina Kraft', 'nina.kraft@example.com', '+49 175 777 6655', current_date + 14, 'FAMILY', 'UNDER_200', 'Need a quick outdoor family shoot in a local park.', 'LOW', 'REPLIED', '203.0.113.12', now() - interval '6 days'
WHERE NOT EXISTS (
    SELECT 1 FROM leads WHERE id = '44444444-4444-4444-4444-444444444442'
);

INSERT INTO leads (id, name, email, phone, event_date, event_type, budget_range, message, score, status, ip_address, created_at)
SELECT '44444444-4444-4444-4444-444444444443', 'Siemens Events', 'events@siemens.example', '+49 170 987 1000', current_date + 35, 'CORPORATE', 'OVER_1000', 'Corporate event coverage for annual internal summit.', 'MED', 'NEW', '203.0.113.13', now() - interval '3 days'
WHERE NOT EXISTS (
    SELECT 1 FROM leads WHERE id = '44444444-4444-4444-4444-444444444443'
);

-- ─────────────────────────────────────────
--  SAMPLE BOOKINGS
-- ─────────────────────────────────────────
INSERT INTO bookings (
    id,
    client_id,
    lead_id,
    client_name,
    client_email,
    event_date,
    event_time,
    event_type,
    location,
    package_id,
    total_amount_cents,
    deposit_amount_cents,
    status,
    internal_notes,
    created_at,
    updated_at
)
SELECT
    '55555555-5555-5555-5555-555555555551',
    '11111111-1111-1111-1111-111111111111',
    null,
    'Maria & Klaus',
    'maria.klaus@example.com',
    current_date + 21,
    '14:00',
    'WEDDING',
    'Berlin, Germany',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    120000,
    30000,
    'DEPOSIT_PAID',
    'Ceremony + evening reception coverage requested.',
    now() - interval '18 days',
    now() - interval '2 days'
WHERE NOT EXISTS (
    SELECT 1 FROM bookings WHERE id = '55555555-5555-5555-5555-555555555551'
);

INSERT INTO bookings (
    id,
    client_id,
    lead_id,
    client_name,
    client_email,
    event_date,
    event_time,
    event_type,
    location,
    package_id,
    total_amount_cents,
    deposit_amount_cents,
    status,
    internal_notes,
    created_at,
    updated_at
)
SELECT
    '55555555-5555-5555-5555-555555555552',
    '22222222-2222-2222-2222-222222222222',
    null,
    'Sophie Richter',
    'sophie.richter@example.com',
    current_date + 9,
    '10:30',
    'PORTRAIT',
    'Munich, Germany',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    35000,
    35000,
    'CONFIRMED',
    'Studio portraits for LinkedIn and website refresh.',
    now() - interval '11 days',
    now() - interval '1 days'
WHERE NOT EXISTS (
    SELECT 1 FROM bookings WHERE id = '55555555-5555-5555-5555-555555555552'
);

INSERT INTO bookings (
    id,
    client_id,
    lead_id,
    client_name,
    client_email,
    event_date,
    event_time,
    event_type,
    location,
    package_id,
    total_amount_cents,
    deposit_amount_cents,
    status,
    internal_notes,
    created_at,
    updated_at
)
SELECT
    '55555555-5555-5555-5555-555555555553',
    '33333333-3333-3333-3333-333333333333',
    null,
    'Thomas Muller',
    'thomas.mueller@example.com',
    current_date + 3,
    '09:00',
    'FAMILY',
    'Hamburg, Germany',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    18000,
    0,
    'ENQUIRY',
    'Requested weekday morning slot, pending final confirmation.',
    now() - interval '4 days',
    now() - interval '4 days'
WHERE NOT EXISTS (
    SELECT 1 FROM bookings WHERE id = '55555555-5555-5555-5555-555555555553'
);

-- Keep client rollups aligned with seeded bookings.
UPDATE clients c
SET total_bookings = b.booking_count,
    total_spent_cents = b.total_spent,
    last_booking_date = b.last_booking_date
FROM (
    SELECT
        client_id,
        count(*)::int AS booking_count,
        COALESCE(sum(total_amount_cents), 0)::int AS total_spent,
        max(event_date) AS last_booking_date
    FROM bookings
    WHERE client_id IS NOT NULL
    GROUP BY client_id
) b
WHERE c.id = b.client_id;
