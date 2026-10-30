-- Indexes aligned to the queries the application actually issues.
--
-- Two systemic gaps this closes:
--
-- 1. Postgres does NOT create an index for a REFERENCES (foreign key) column.
--    delivery_photos.gallery_id was declared as a plain FK, so every lookup of
--    a gallery's photos — and, worse, the correlated COUNT(*) subquery inside
--    GalleryRepository#findAllWithStats, which runs once per gallery row —
--    fell back to a sequential scan of the whole delivery_photos table. The
--    gallery list page therefore scanned every delivery photo in the tenant N
--    times, where N is the number of galleries. The ON DELETE CASCADE from
--    galleries paid the same cost on every delete.
--
-- 2. Every tenant-scoped query carries an implicit `tenant_id = ...` predicate
--    from the RLS policy (V11), on top of whatever the repository method
--    filters/sorts by. The existing single-column indexes made Postgres either
--    bitmap-AND two of them or scan one and filter the rest. Leading each
--    composite with tenant_id lets a single index satisfy the RLS predicate
--    and the filter/sort together, which also makes the ORDER BY ... LIMIT on
--    the paginated list endpoints an index scan instead of a full sort.
--
-- The single-column indexes replaced below are strictly subsumed by the new
-- composites (same leading column), so dropping them costs nothing at read
-- time and saves the write amplification of maintaining both.

-- ── delivery_photos ───────────────────────────────────────────────────────
-- Covers findByGalleryIdOrderBySortOrderAsc (owner + public client view), the
-- photoCount subquery, and the cascade delete. sort_order is included so the
-- ordering comes off the index rather than a sort node.
CREATE INDEX idx_delivery_photos_gallery ON delivery_photos (gallery_id, sort_order);

-- ── galleries ─────────────────────────────────────────────────────────────
-- findAllWithStats orders by created_at within the tenant. (access_token
-- already has an implicit index via uq_gallery_token.)
CREATE INDEX idx_galleries_tenant_created ON galleries (tenant_id, created_at DESC);
DROP INDEX idx_galleries_tenant_id;

-- ── leads ─────────────────────────────────────────────────────────────────
-- getLeads/getRecentLeads sort by created_at DESC and optionally filter by
-- score and/or status — all within one tenant.
CREATE INDEX idx_leads_tenant_created ON leads (tenant_id, created_at DESC);
CREATE INDEX idx_leads_tenant_status  ON leads (tenant_id, status);
CREATE INDEX idx_leads_tenant_score   ON leads (tenant_id, score);
DROP INDEX idx_leads_tenant_id;
DROP INDEX idx_leads_status;
DROP INDEX idx_leads_score;
DROP INDEX idx_leads_created_at;

-- ── bookings ──────────────────────────────────────────────────────────────
-- listForPhotographer sorts by event_date and optionally filters by status;
-- getOwnBookings filters on upper(client_email) and optionally status.
CREATE INDEX idx_bookings_tenant_event_date ON bookings (tenant_id, event_date);
CREATE INDEX idx_bookings_tenant_status     ON bookings (tenant_id, status);
CREATE INDEX idx_bookings_tenant_email      ON bookings (tenant_id, upper(client_email), event_date);
DROP INDEX idx_bookings_tenant_id;
DROP INDEX idx_bookings_status;
DROP INDEX idx_bookings_event_date;
DROP INDEX idx_bookings_client_email_upper;

-- ── inquiry_requests ──────────────────────────────────────────────────────
-- listForPhotographer sorts by created_at DESC, optionally filtered by status;
-- listForCustomer filters by customer_id with the same ordering.
CREATE INDEX idx_inquiry_tenant_created  ON inquiry_requests (tenant_id, created_at DESC);
CREATE INDEX idx_inquiry_tenant_status   ON inquiry_requests (tenant_id, status);
CREATE INDEX idx_inquiry_customer_created ON inquiry_requests (customer_id, created_at DESC);
DROP INDEX idx_inquiry_requests_tenant_id;
DROP INDEX idx_inquiry_requests_status;
DROP INDEX idx_inquiry_requests_created_at;
DROP INDEX idx_inquiry_requests_customer;

-- ── photos ────────────────────────────────────────────────────────────────
-- listAll sorts by sort_order within the tenant; listPublished adds the
-- is_published filter, which the partial index below serves exactly (the
-- public portfolio page is the hottest read in the app).
CREATE INDEX idx_photos_tenant_sort ON photos (tenant_id, sort_order);
CREATE INDEX idx_photos_published   ON photos (tenant_id, sort_order) WHERE is_published;
DROP INDEX idx_photos_tenant_id;
DROP INDEX idx_photos_sort;

-- ── payments ──────────────────────────────────────────────────────────────
-- Every balance calculation (outstandingCents, getSummary, the booking payment
-- state resolver) sums only SUCCEEDED rows for an invoice. A partial index
-- keeps PENDING/FAILED/CANCELED attempts out of it entirely, so the sum reads
-- only rows that can contribute to it.
CREATE INDEX idx_payments_invoice_succeeded ON payments (invoice_id)
    WHERE status = 'SUCCEEDED';
-- findByInvoiceIdOrderByCreatedAtDesc (the full attempt history) and the
-- open-intent lookup still want every status, ordered.
CREATE INDEX idx_payments_invoice_created ON payments (invoice_id, created_at DESC);
DROP INDEX idx_payments_invoice_id;

-- ── invoices ──────────────────────────────────────────────────────────────
-- booking_id backs both listForBooking and the batched booking payment-state
-- resolver, both of which order by issued_at.
--
-- Deliberately NOT adding anything for findByIssueYearOrderByIssuedAtAsc (the
-- DATEV export): uq_invoices_number is already a unique index leading with
-- (tenant_id, issue_year), so it serves that predicate. A second index would
-- only add write cost for a once-a-year report.
CREATE INDEX idx_invoices_booking_issued ON invoices (booking_id, issued_at DESC);
DROP INDEX idx_invoices_booking_id;

-- ── invoice_line_items ────────────────────────────────────────────────────
-- findByInvoiceIdIn... groups a whole booking's history in one query; the
-- sort_order column keeps each invoice's line order off the index.
CREATE INDEX idx_invoice_line_items_invoice_sort
    ON invoice_line_items (invoice_id, sort_order);
DROP INDEX idx_invoice_line_items_invoice_id;

-- ── audit_log ─────────────────────────────────────────────────────────────
-- LeadService#getActivity reads (tenant_id, entity_type, entity_id) ordered by
-- created_at DESC — the tenant-scoped variant, which the existing
-- entity-only index could not serve without an extra filter step.
CREATE INDEX idx_audit_log_tenant_entity
    ON audit_log (tenant_id, entity_type, entity_id, created_at DESC);
DROP INDEX idx_audit_log_entity;
