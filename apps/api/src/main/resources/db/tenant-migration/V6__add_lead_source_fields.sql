-- Add source tracking and Instagram integration fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(30);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ig_message_id VARCHAR(100);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ig_username VARCHAR(100);

-- Add index for Instagram message ID for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_ig_message_id ON leads (ig_message_id) WHERE ig_message_id IS NOT NULL;
