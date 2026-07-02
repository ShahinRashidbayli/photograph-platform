-- Add internal_notes to leads. The FE has been rendering a placeholder
-- "Editing internal notes is coming soon" — this column unblocks that
-- (PATCH /api/leads/{id}/notes). Nullable + no default since most existing
-- leads won't have notes.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS internal_notes TEXT;
