package com.photographplatform.api.gallery.service;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.AsyncConfig;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.media.BoundedImageDecoder;
import com.photographplatform.api.common.media.BoundedImageDecoder.DecodedImage;
import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.portfolio.service.ThumbnailService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Builds the derivative images a client gallery serves: a thumbnail for every
 * delivered photo, plus a watermarked copy when the gallery asks for one.
 *
 * <p>Runs off the request thread. Upload-complete returns as soon as the row
 * is saved, and the client's browser is already uploading the next file while
 * this works through the last one.
 *
 * <h2>Why delivery photos need their own processor</h2>
 * {@link ThumbnailService} covers portfolio photos and is bound to that
 * entity. Delivery photos were never wired to anything equivalent, so
 * {@code thumbnail_key} stayed null for every delivered image and the gallery
 * fell back to the full-resolution original for each grid tile — a 400-photo
 * wedding gallery pulled hundreds of megabytes to render a contact sheet.
 * Watermarking needs the same decode-once pipeline, so both live here.
 */
@Service
public class DeliveryPhotoProcessor {

    private static final Logger LOG = LoggerFactory.getLogger(DeliveryPhotoProcessor.class);
    private static final String JPEG = "image/jpeg";

    private final Optional<R2StorageService> storage;
    private final DeliveryPhotoRepository deliveryPhotoRepository;
    private final GalleryRepository galleryRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final WatermarkRenderer watermarkRenderer;

    /**
     * Transactions are opened explicitly, around the database work only.
     *
     * <p>Annotating the whole job {@code @Transactional} would hold one pooled
     * connection for its entire duration — and the duration is dominated by
     * things that are not the database: an R2 round-trip per photo, a JPEG
     * decode, a watermark render, three uploads. Backfilling a 400-photo
     * wedding gallery would pin a connection (and an idle-in-transaction
     * session on the server) for minutes, and a handful of photographers
     * toggling watermarking at once would drain the Hikari pool and stall
     * every unrelated request.
     */
    private final TransactionTemplate txTemplate;

    public DeliveryPhotoProcessor(Optional<R2StorageService> storage,
                                  DeliveryPhotoRepository deliveryPhotoRepository,
                                  GalleryRepository galleryRepository,
                                  TenantRepository tenantRepository,
                                  UserRepository userRepository,
                                  WatermarkRenderer watermarkRenderer,
                                  PlatformTransactionManager txManager) {
        this.storage = storage;
        this.deliveryPhotoRepository = deliveryPhotoRepository;
        this.galleryRepository = galleryRepository;
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.watermarkRenderer = watermarkRenderer;
        this.txTemplate = new TransactionTemplate(txManager);
    }

    /**
     * Generates the derivatives for one freshly-uploaded photo.
     *
     * @param photoId  the delivery photo whose original is now in R2
     * @param tenantId re-bound explicitly on the worker thread; see
     *                 {@link ThumbnailService} for why this is not left to the
     *                 async decorator alone
     */
    @Async(AsyncConfig.IMAGE_EXECUTOR)
    public void process(UUID photoId, String tenantId) {
        if (storage.isEmpty()) {
            LOG.info("R2 not configured; skipping derivatives for delivery photo {}", photoId);
            return;
        }
        TenantContext.setTenant(tenantId);
        try {
            Target target = txTemplate.execute(status -> {
                DeliveryPhoto photo = deliveryPhotoRepository.findById(photoId).orElse(null);
                if (photo == null) {
                    LOG.warn("Delivery photo {} not found for processing", photoId);
                    return null;
                }
                Gallery gallery = galleryRepository.findById(photo.getGalleryId()).orElse(null);
                if (gallery == null) {
                    LOG.warn("Gallery {} vanished before photo {} was processed",
                        photo.getGalleryId(), photoId);
                    return null;
                }
                return new Target(photo, Boolean.TRUE.equals(gallery.getWatermarkEnabled()));
            });
            if (target == null) {
                return;
            }
            buildDerivatives(target.photo(), target.watermark(),
                target.watermark() ? watermarkLabel() : null);
        } finally {
            TenantContext.clear();
        }
    }

    /** A photo plus whether its gallery wants it watermarked. */
    private record Target(DeliveryPhoto photo, boolean watermark) {
    }

    /**
     * Generates the watermarked copies a gallery is missing.
     *
     * <p>Called when the photographer switches watermarking on for a gallery
     * whose photos were uploaded while it was off. Without this the flag would
     * only affect photos uploaded after the change, which is the kind of
     * half-applied setting nobody discovers until a client has already
     * downloaded an unmarked file.
     *
     * <p>Idempotent: photos that already have a derivative are skipped, so a
     * repeated toggle costs nothing.
     */
    @Async(AsyncConfig.IMAGE_EXECUTOR)
    public void backfillWatermarks(UUID galleryId, String tenantId) {
        if (storage.isEmpty()) {
            LOG.info("R2 not configured; skipping watermark backfill for gallery {}", galleryId);
            return;
        }
        TenantContext.setTenant(tenantId);
        try {
            List<DeliveryPhoto> pending = txTemplate.execute(status ->
                deliveryPhotoRepository.findByGalleryIdAndWatermarkKeyIsNull(galleryId));
            if (pending == null || pending.isEmpty()) {
                return;
            }
            // Resolved once, not per photo: it is two queries (tenant, then the
            // owner user) that return the same answer every time, and a
            // 400-photo gallery would otherwise issue 800 of them.
            String label = watermarkLabel();
            LOG.info("Watermarking {} existing photo(s) in gallery {}", pending.size(), galleryId);
            for (DeliveryPhoto photo : pending) {
                buildDerivatives(photo, true, label);
            }
        } finally {
            TenantContext.clear();
        }
    }

    // ── internals ────────────────────────────────────────────────────────────

    /**
     * Decodes the original once and writes whichever derivatives are missing.
     * Failures are logged and swallowed per photo: one undecodable file (a
     * CMYK JPEG, a truncated upload) must not abort the rest of a 400-photo
     * gallery.
     */
    private void buildDerivatives(DeliveryPhoto photo, boolean watermark, String label) {
        boolean needsThumbnail = photo.getThumbnailKey() == null;
        boolean needsWatermark = watermark && photo.getWatermarkKey() == null;
        if (!needsThumbnail && !needsWatermark) {
            return;
        }

        R2StorageService r2 = storage.orElseThrow();
        try {
            DecodedImage decoded = BoundedImageDecoder.decode(r2.downloadBytes(photo.getR2Key()));
            if (decoded == null) {
                LOG.warn("Could not decode delivery photo {} (key={})",
                    photo.getId(), photo.getR2Key());
                return;
            }
            BufferedImage source = decoded.image();

            String thumbKey = null;
            if (needsThumbnail) {
                thumbKey = ThumbnailService.thumbnailKeyFor(photo.getR2Key());
                r2.uploadBytes(thumbKey, JPEG, ThumbnailService.renderThumbnail(source));
            }

            String watermarkKey = null;
            if (needsWatermark) {
                byte[] marked = watermarkRenderer.render(source, label);

                // The client's grid must not fall back to the clean thumbnail,
                // so the watermarked copy gets a thumbnail of its own — derived
                // from the already-marked pixels rather than re-stamped.
                //
                // Produced BEFORE anything is written: if this fails, leaving
                // watermark_key set would point the gallery at a thumbnail
                // object that does not exist, and the partial-index backfill
                // query (watermark_key IS NULL) would never pick the photo up
                // to retry. Bailing out keeps it on the work list.
                DecodedImage markedImage = BoundedImageDecoder.decode(marked);
                if (markedImage == null) {
                    LOG.warn("Could not re-read the watermarked copy of delivery photo {}; "
                        + "leaving it unmarked so the next backfill retries it", photo.getId());
                    return;
                }

                watermarkKey = watermarkKeyFor(photo.getR2Key());
                r2.uploadBytes(watermarkKey, JPEG, marked);
                r2.uploadBytes(
                    ThumbnailService.thumbnailKeyFor(watermarkKey),
                    JPEG,
                    ThumbnailService.renderThumbnail(markedImage.image()));
            }

            // Re-read inside the write transaction rather than saving the
            // detached instance loaded earlier: the row may have been updated
            // in the meantime (completeUpload writes file_size_bytes), and
            // persisting the stale snapshot would silently roll that back.
            String finalThumbKey = thumbKey;
            String finalWatermarkKey = watermarkKey;
            // The file's dimensions, not the decoded raster's: a large original
            // is decoded subsampled.
            int width = decoded.sourceWidth();
            int height = decoded.sourceHeight();
            txTemplate.executeWithoutResult(status -> {
                DeliveryPhoto fresh = deliveryPhotoRepository.findById(photo.getId()).orElse(null);
                if (fresh == null) {
                    return;
                }
                if (finalThumbKey != null) {
                    fresh.setThumbnailKey(finalThumbKey);
                }
                if (finalWatermarkKey != null) {
                    fresh.setWatermarkKey(finalWatermarkKey);
                }
                if (fresh.getWidth() == null) {
                    fresh.setWidth(width);
                }
                if (fresh.getHeight() == null) {
                    fresh.setHeight(height);
                }
                deliveryPhotoRepository.save(fresh);
            });
        } catch (IOException | RuntimeException e) {
            LOG.error("Failed to build derivatives for delivery photo {}: {}",
                photo.getId(), e.getMessage(), e);
        }
    }

    /**
     * What gets stamped across the photo. The business name is the identity a
     * photographer trades and invoices under, so it is the right mark; the
     * owner's own name and finally the subdomain stand in for a profile that
     * has not been filled out yet.
     */
    private String watermarkLabel() {
        String tenantId = TenantContext.getTenant();
        if (tenantId == null) {
            return "";
        }
        Tenant tenant = tenantRepository.findById(UUID.fromString(tenantId)).orElse(null);
        if (tenant == null) {
            return "";
        }
        if (tenant.getBusinessName() != null && !tenant.getBusinessName().isBlank()) {
            return tenant.getBusinessName();
        }
        // The studio's owner, asked of the staff row rather than reconstructed
        // by matching tenants.owner_email — see PublicTenantResolver for why
        // that stopped being the same question once studios gained seats. A
        // member's name must never end up on someone else's watermark.
        String ownerName = userRepository.findOwnerByTenantId(tenant.getId())
            .map(User::getFullName)
            .orElse(null);
        return ownerName != null && !ownerName.isBlank() ? ownerName : tenant.getSubdomain();
    }

    /**
     * Sibling key next to the original, mirroring
     * {@link ThumbnailService#thumbnailKeyFor(String)}:
     * {@code {tenant}/galleries/{id}/abc.jpg → {tenant}/galleries/{id}/wm_abc.jpg}
     *
     * <p>Always {@code .jpg} — the derivative is re-encoded as JPEG regardless
     * of what was uploaded, and a key claiming {@code .png} would make the
     * object's extension disagree with its bytes.
     */
    static String watermarkKeyFor(String originalKey) {
        int slash = originalKey.lastIndexOf('/');
        String dir = slash >= 0 ? originalKey.substring(0, slash + 1) : "";
        String base = slash >= 0 ? originalKey.substring(slash + 1) : originalKey;
        int dot = base.lastIndexOf('.');
        String stem = dot >= 0 ? base.substring(0, dot) : base;
        return dir + "wm_" + stem + ".jpg";
    }
}
