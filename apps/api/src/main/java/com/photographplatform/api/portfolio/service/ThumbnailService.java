package com.photographplatform.api.portfolio.service;

import com.photographplatform.api.common.config.AsyncConfig;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.media.BoundedImageDecoder;
import com.photographplatform.api.common.media.BoundedImageDecoder.DecodedImage;
import com.photographplatform.api.portfolio.domain.Photo;
import com.photographplatform.api.portfolio.repository.PhotoRepository;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;
import net.coobird.thumbnailator.Thumbnails;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Generates a 400px JPEG thumbnail for a freshly-uploaded photo. Runs
 * asynchronously off the request thread — the upload-complete endpoint
 * fires this and returns immediately.
 *
 * <h2>Transactions</h2>
 * Opened explicitly, around the two database touches only. The method used to
 * be {@code @Transactional} as a whole, which held a pooled connection through
 * the R2 download, the decode and the upload — seconds per photo, on a pool of
 * ten. It also opened that transaction before the method body ran, so the
 * {@code TenantContext.setTenant} below came after {@code TenantRoutingDataSource}
 * had already bound {@code app.tenant_id} for the transaction: the explicit
 * tenant only worked because the async decorator had happened to set the same
 * one first. Setting the tenant and then opening each transaction makes the
 * order the code reads in the order that actually applies.
 */
@Service
public class ThumbnailService {

    private static final Logger LOG = LoggerFactory.getLogger(ThumbnailService.class);
    private static final int THUMB_MAX_DIM = 400;
    private static final float JPEG_QUALITY = 0.85f;
    private static final String THUMB_CONTENT_TYPE = "image/jpeg";

    private final Optional<R2StorageService> storage;
    private final PhotoRepository photoRepository;
    private final TransactionTemplate txTemplate;

    public ThumbnailService(Optional<R2StorageService> storage, PhotoRepository photoRepository,
                            PlatformTransactionManager txManager) {
        this.storage = storage;
        this.photoRepository = photoRepository;
        this.txTemplate = new TransactionTemplate(txManager);
    }

    @Async(AsyncConfig.IMAGE_EXECUTOR)
    public void generateThumbnail(UUID photoId, String tenantId) {
        if (storage.isEmpty()) {
            LOG.info("R2 not configured; skipping thumbnail for photo {}", photoId);
            return;
        }

        TenantContext.setTenant(tenantId);
        try {
            String r2Key = txTemplate.execute(status ->
                photoRepository.findById(photoId).map(Photo::getR2Key).orElse(null));
            if (r2Key == null) {
                LOG.warn("Photo {} not found for thumbnail generation", photoId);
                return;
            }

            DecodedImage decoded = BoundedImageDecoder.decode(storage.get().downloadBytes(r2Key));
            if (decoded == null) {
                LOG.warn("Could not decode image for photo {} (key={})", photoId, r2Key);
                return;
            }

            byte[] thumbnail = renderThumbnail(decoded.image());

            String thumbKey = thumbnailKeyFor(r2Key);
            storage.get().uploadBytes(thumbKey, THUMB_CONTENT_TYPE, thumbnail);

            // Re-read for the write rather than saving the copy loaded above:
            // the photo can be edited or deleted while this ran.
            txTemplate.executeWithoutResult(status -> {
                Photo photo = photoRepository.findById(photoId).orElse(null);
                if (photo == null) {
                    return;
                }
                // Backfill dimensions if the client didn't supply them at
                // complete-time — the file's own, not the decoded raster's,
                // which may have been subsampled.
                if (photo.getWidth() == null) {
                    photo.setWidth(decoded.sourceWidth());
                }
                if (photo.getHeight() == null) {
                    photo.setHeight(decoded.sourceHeight());
                }
                photo.setThumbnailKey(thumbKey);
                photoRepository.save(photo);
            });

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
