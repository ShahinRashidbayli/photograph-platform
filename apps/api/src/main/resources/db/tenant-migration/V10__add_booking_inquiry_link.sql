-- A booking can now originate from a customer InquiryRequest (accept → booking),
-- mirroring the existing lead_id soft link. Nullable and un-constrained like
-- lead_id: most bookings have neither, and the link is for the audit trail /
-- reporting join ("this booking started as an inquiry"), not referential
-- enforcement. inquiry_requests lives in the same tenant schema.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS inquiry_id UUID;
