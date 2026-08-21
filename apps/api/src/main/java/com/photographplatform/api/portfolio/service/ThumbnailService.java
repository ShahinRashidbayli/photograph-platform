package com.photographplatform.api.portfolio.service;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.portfolio.domain.Photo;
import com.photographplatform.api.portfolio.repository.PhotoRepository;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;
import javax.imageio.ImageIO;
import net.coobird.thumbnailator.Thumbnails;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Generates a 400px JPEG thumbnail for a freshly-uploaded photo. Runs
 * asynchronously off the request thread — the upload-complete endpoint
 * fires this and returns immediately.
 *
 * <p>Tenant context is captured by {@code AsyncConfig} (see {@code @Async}
 * propagation), but we re-set it explicitly here as defence-in-depth: the
 * DB write goes through the tenant-routed datasource and would otherwise
 * land in whatever schema happens to be on the pooled connection.
 */
@Service
public class ThumbnailService {

    private static final Logger LOG = LoggerFactory.getLogger(ThumbnailService.class);
    private static final int THUMB_MAX_DIM = 400;
    private static final float JPEG_QUALITY = 0.85f;
    private static final String THUMB_CONTENT_TYPE = "image/jpeg";

    private final Optional<R2StorageService> storage;
    private final PhotoRepository photoRepository;

    public ThumbnailService(Optional<R2StorageService> storage, PhotoRepository photoRepository) {
        this.storage = storage;
        this.photoRepository = photoRepository;
    }

    @Async
    @Transactional
    public void generateThumbnail(UUID photoId, String tenantId) {
        if (storage.isEmpty()) {
            LOG.info("R2 not configured; skipping thumbnail for photo {}", photoId);
            return;
        }

        TenantContext.setTenant(tenantId);
        try {
            Photo photo = photoRepository.findById(photoId).orElse(null);
            if (photo == null) {
                LOG.warn("Photo {} not found for thumbnail generation", photoId);
                return;
            }

            byte[] originalBytes = storage.get().downloadBytes(photo.getR2Key());

            // Read once to capture dimensions, then resize from the same buffer.
            BufferedImage src = ImageIO.read(new ByteArrayInputStream(originalBytes));
            if (src == null) {
                LOG.warn("Could not decode image for photo {} (key={})", photoId, photo.getR2Key());
                return;
            }

            byte[] thumbnail = renderThumbnail(src);

            String thumbKey = thumbnailKeyFor(photo.getR2Key());
            storage.get().uploadBytes(thumbKey, THUMB_CONTENT_TYPE, thumbnail);

            // Backfill dimensions if the client didn't supply them at complete-time.
            if (photo.getWidth() == null) {
                photo.setWidth(src.getWidth());
            }
            if (photo.getHeight() == null) {
                photo.setHeight(src.getHeight());
            }
            photo.setThumbnailKey(thumbKey);
            photoRepository.save(photo);

            LOG.info("Thumbnail generated for photo {} ({} bytes)", photoId, thumbnail.length);
        } catch (IOException e) {
            LOG.error("Failed to generate thumbnail for photo {}: {}", photoId, e.getMessage(), e);
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * Scales a decoded image down to a {@value #THUMB_MAX_DIM}px JPEG.
     *
     * <p>Static and side-effect-free so the gallery's delivery pipeline
     * ({@code DeliveryPhotoProcessor}) produces byte-identical thumbnails from
     * the same source without duplicating the encoder settings — two
     * independent copies of "what a thumbnail is" would drift.
     */
    public static byte[] renderThumbnail(BufferedImage source) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Thumbnails.of(source)
            .size(THUMB_MAX_DIM, THUMB_MAX_DIM)
            .keepAspectRatio(true)
            .outputFormat("jpg")
            .outputQuality(JPEG_QUALITY)
            .toOutputStream(out);
        return out.toByteArray();
    }

    /**
     * Sibling key next to the original. Example:
     *   {tenantId}/photos/abc.jpg → {tenantId}/photos/thumb_abc.jpg
     */
    public static String thumbnailKeyFor(String originalKey) {
        int slash = originalKey.lastIndexOf('/');
        String dir = slash >= 0 ? originalKey.substring(0, slash + 1) : "";
        String base = slash >= 0 ? originalKey.substring(slash + 1) : originalKey;
        int dot = base.lastIndexOf('.');
        String stem = dot >= 0 ? base.substring(0, dot) : base;
        return dir + "thumb_" + stem + ".jpg";
    }
}
