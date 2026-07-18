-- Gallery access tokens are the sole credential for a client's private gallery,
-- so they must be unguessable. The application always supplies one (a 64-char
-- value built from two random UUIDs in Gallery.generateToken), but the column's
-- DB default was md5(random()::text || clock_timestamp()::text) repeated twice.
-- md5(random()) is not cryptographically secure — random() is a PRNG seeded per
-- session, so a default-generated token would be predictable. The app path never
-- hits this default, but defence-in-depth: any raw insert should still produce a
-- strong token. gen_random_uuid() (pgcrypto/pg 13+) is CSPRNG-backed and matches
-- what the application writes.
ALTER TABLE galleries
    ALTER COLUMN access_token
    SET DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
