-- old_value / new_value were JSONB but callers pass plain strings (e.g. "CONFIRMED").
-- TEXT accepts any string without JSON-validity checks, which is all we need for
-- human-readable audit trail values.
ALTER TABLE public.audit_log
    ALTER COLUMN old_value TYPE TEXT USING old_value::TEXT,
    ALTER COLUMN new_value TYPE TEXT USING new_value::TEXT;
