-- 1. Drop the old constraint first so rows with old values can be updated
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;

-- 2. Migrate existing rows to new role values
UPDATE users SET role = 'PHOTOGRAPHER' WHERE role IN ('OWNER', 'ASSISTANT');

-- 3. Add the new constraint
ALTER TABLE users ADD CONSTRAINT chk_users_role
    CHECK (role IN ('PHOTOGRAPHER', 'CUSTOMER', 'ADMIN'));

-- 4. Update default
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'PHOTOGRAPHER';
