-- Watermarked derivatives for client-gallery deliveries.
--
-- Until now `galleries.watermark_enabled` was a flag and nothing more: it was
-- persisted, returned to the photographer's UI and to the public gallery
-- payload, and never applied to a single pixel. A photographer who switched it
-- on was told their delivery was protected while the client kept receiving the
-- untouched original — a silent promise the product did not keep.
--
-- The original in `r2_key` is never modified. Watermarking writes a separate
-- derivative and the public view serves that instead, so turning the flag off
-- restores clean delivery instantly and the master file is always recoverable.
ALTER TABLE delivery_photos
    ADD COLUMN watermark_key VARCHAR(500);

COMMENT ON COLUMN delivery_photos.watermark_key IS
    'Key of the watermarked derivative, or NULL if none has been generated. '
    'Serving is driven by galleries.watermark_enabled, not by this column: a '
    'gallery with the flag on but no derivative yet withholds the photo rather '
    'than falling back to the unmarked original.';

-- Finding the photos still missing a derivative after the flag is switched on
-- is a per-gallery backfill scan; without this it is a full-table filter.
CREATE INDEX idx_delivery_photos_gallery_pending_watermark
    ON delivery_photos (gallery_id)
    WHERE watermark_key IS NULL;
