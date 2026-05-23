-- Seed sample galleries for the existing seeded bookings so the
-- /galleries page has something to render in dev. Idempotent.

INSERT INTO galleries (id, booking_id, expires_at, download_enabled, watermark_enabled, view_count, created_at)
SELECT '66666666-6666-6666-6666-666666666661',
       '55555555-5555-5555-5555-555555555552',
       now() + interval '90 days',
       true,
       false,
       12,
       now() - interval '5 days'
WHERE NOT EXISTS (
    SELECT 1 FROM galleries WHERE id = '66666666-6666-6666-6666-666666666661'
);

INSERT INTO galleries (id, booking_id, expires_at, download_enabled, watermark_enabled, view_count, created_at)
SELECT '66666666-6666-6666-6666-666666666662',
       '55555555-5555-5555-5555-555555555551',
       now() + interval '180 days',
       true,
       true,
       3,
       now() - interval '1 day'
WHERE NOT EXISTS (
    SELECT 1 FROM galleries WHERE id = '66666666-6666-6666-6666-666666666662'
);
