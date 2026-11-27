package com.photographplatform.api.gallery.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.repository.QueryLimits;
import com.photographplatform.api.branding.service.BrandingService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.media.ImageUploadType;
import com.photographplatform.api.common.media.UploadLimits;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.domain.GalleryExpiryState;
import com.photographplatform.api.gallery.dto.CreateGalleryRequest;
import com.photographplatform.api.gallery.dto.DeliveryPhotoResponse;
import com.photographplatform.api.gallery.dto.GalleryDownloadPlan;
import com.photographplatform.api.gallery.dto.GalleryResponse;
import com.photographplatform.api.gallery.dto.PublicGalleryResponse;
import com.photographplatform.api.gallery.dto.UpdateGalleryRequest;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository.GalleryStatsView;
import com.photographplatform.api.portfolio.dto.CompleteUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadResponse;
import com.photographplatform.api.portfolio.config.R2Properties;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.portfolio.service.ThumbnailService;
import com.photographplatform.api.common.security.RateLimiter;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Gallery management for the photographer, plus the token-addressed public
 * view for the client. Delivery photos reuse the portfolio's R2 presign flow,
 * so — exactly like the portfolio — object URLs are only produced when R2 is
 * configured; without it the rows still round-trip with null image URLs.
 */
@Service
public class GalleryService {

    private final GalleryRepository galleryRepository;
    private final BrandingService brandingService;
    private final DeliveryPhotoRepository deliveryPhotoRepository;
    private final BookingRepository bookingRepository;
    private final Optional<R2StorageService> storage;
    private final AuditService auditService;
    private final DeliveryPhotoProcessor photoProcessor;
    private final EntitlementService entitlementService;
    private final Clock clock;
    private final RateLimiter rateLimiter;
    private final R2Properties r2Properties;

    /** See {@link #prepareDownload} — the ZIP is the costliest thing we serve. */
    private static final int DOWNLOAD_MAX_PER_DAY = 20;
    private static final Duration DOWNLOAD_WINDOW = Duration.ofDays(1);

    public GalleryService(GalleryRepository galleryRepository,
                          DeliveryPhotoRepository deliveryPhotoRepository,
                          BookingRepository bookingRepository,
                          Optional<R2StorageService> storage,
                          AuditService auditService,
                          DeliveryPhotoProcessor photoProcessor,
                          EntitlementService entitlementService,
                          Clock clock,
                          RateLimiter rateLimiter,
                          R2Properties r2Properties,
        BrandingService brandingService
    ) {
        this.galleryRepository = galleryRepository;
        this.brandingService = brandingService;
        this.deliveryPhotoRepository = deliveryPhotoRepository;
        this.bookingRepository = bookingRepository;
        this.storage = storage;
        this.auditService = auditService;
        this.photoProcessor = photoProcessor;
        this.entitlementService = entitlementService;
        this.clock = clock;
        this.rateLimiter = rateLimiter;
        this.r2Properties = r2Properties;
    }

    @Transactional(readOnly = true)
    public List<GalleryResponse> listAll() {
        return galleryRepository.findAllWithStats(QueryLimits.LIST).stream()
            .map(GalleryService::toResponse)
            .toList();
    }

    // ── owner: manage ──────────────────────────────────────────────────────

    @Transactional
    public GalleryResponse create(CreateGalleryRequest req, String ipAddress) {
        if (!bookingRepository.existsById(req.bookingId())) {
            throw new NotFoundException("Booking not found: " + req.bookingId());
        }
        // Retention comes from the tenant's plan and nowhere else (ADR-001
        // §4): it is one of the two things the tiers actually sell, so a
        // client-supplied date would let any tenant grant itself Studio's two
        // years. Captured onto the row now rather than resolved at read time,
        // so a later plan change cannot rewrite the window a client was
        // already promised.
        int retentionDays = entitlementService.accessForCurrentTenant()
            .entitlements().galleryRetentionDays();
        Gallery gallery = new Gallery(
            req.bookingId(),
            OffsetDateTime.now(clock),
            retentionDays,
            req.downloadEnabled() == null ? true : req.downloadEnabled(),
            req.watermarkEnabled() == null ? false : req.watermarkEnabled()
        );
        gallery.setTenantId(SecurityUtils.requireCurrentTenantId());
        gallery = galleryRepository.save(gallery);
        audit("GALLERY_CREATED", gallery.getId(), ipAddress);
        return toResponse(requireStats(gallery.getId()));
    }

    @Transactional
    public GalleryResponse update(UUID id, UpdateGalleryRequest req, String ipAddress) {
        Gallery gallery = galleryRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Gallery not found: " + id));
        // Expiry is deliberately NOT settable here any more. It used to be,
        // which meant the same PATCH that toggles downloads could hand a
        // gallery any retention window the browser asked for. Extending is now
        // its own operation with its own rules — see extend().
        if (req.downloadEnabled() != null) {
            gallery.setDownloadEnabled(req.downloadEnabled());
        }
        // Captured before the setter: switching watermarking ON has to reach
        // back and mark the photos that were uploaded while it was off. Without
        // that, the setting would only apply to future uploads and the
        // photographer would have no way to tell which of their client's photos
        // are actually protected.
        boolean watermarkSwitchedOn = req.watermarkEnabled() != null
            && req.watermarkEnabled()
            && !Boolean.TRUE.equals(gallery.getWatermarkEnabled());
        if (req.watermarkEnabled() != null) {
            gallery.setWatermarkEnabled(req.watermarkEnabled());
        }
        galleryRepository.save(gallery);
        audit("GALLERY_UPDATED", id, ipAddress);
        if (watermarkSwitchedOn) {
            String tenantId = TenantContext.getTenant();
            afterCommit(() -> photoProcessor.backfillWatermarks(id, tenantId));
        }
        return toResponse(requireStats(id));
    }

    /**
     * Grants one more full retention window (ADR-001 §4.2).
     *
     * <p>This is a non-negotiable half of being allowed to delete anything at
     * all: "without it, every missed window becomes a support ticket we are
     * unable to resolve, because the data is already gone."
     *
     * <p>Works on an already-expired gallery, which is the entire purpose of
     * the grace period — the photographer who notices late is exactly the
     * person this exists for. It refuses only once the bytes are actually
     * gone, because there is then nothing left to bring back.
     *
     * <p>The new window is a full plan-sized window measured from now, not the
     * remainder of the old one: restoring a gallery that lapsed three weeks
     * ago into a window that has already passed would help nobody. It never
     * shortens what the gallery already has (see {@link Gallery#extend}).
     */
    @Transactional
    public GalleryResponse extend(UUID id, String ipAddress) {
        Gallery gallery = galleryRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Gallery not found: " + id));

        if (!gallery.canExtend()) {
            throw new ConflictException(
                "This gallery's photos have already been deleted and cannot be restored. "
                    + "Upload them again to deliver a new gallery.");
        }

        int retentionDays = entitlementService.accessForCurrentTenant()
            .entitlements().galleryRetentionDays();
        if (gallery.extend(OffsetDateTime.now(clock), retentionDays)) {
            galleryRepository.save(gallery);
            audit("GALLERY_EXTENDED", id, ipAddress);
        }
        return toResponse(requireStats(id));
    }

    /** Deletes the gallery and its photos' files; see {@link GalleryRemoval}. */
    @Transactional
    public void delete(UUID id, String ipAddress) {
        Gallery gallery = galleryRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Gallery not found: " + id));
        GalleryRemoval.remove(gallery, galleryRepository, deliveryPhotoRepository, storage);
        audit("GALLERY_DELETED", id, ipAddress);
    }

    @Transactional(readOnly = true)
    public List<DeliveryPhotoResponse> listPhotos(UUID galleryId) {
        if (!galleryRepository.existsById(galleryId)) {
            throw new NotFoundException("Gallery not found: " + galleryId);
        }
        return deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(galleryId, QueryLimits.LIST)
            .stream()
            .map(this::toPhotoResponse)
            .toList();
    }

    // ── owner: upload ──────────────────────────────────────────────────────

    /**
     * Mints a pre-signed PUT for one delivered photo. Same contract as the
     * portfolio's: the accepted type and the exact size are decided here and
     * signed into the URL, because once it is handed out the browser uploads
     * straight to R2 and nothing downstream can refuse what arrives.
     */
    @Transactional
    public InitiateUploadResponse initiatePhotoUpload(UUID galleryId, InitiateUploadRequest req) {
        if (!galleryRepository.existsById(galleryId)) {
            throw new NotFoundException("Gallery not found: " + galleryId);
        }
        ImageUploadType type = ImageUploadType.resolve(req.contentType(), req.filename());
        long sizeBytes = UploadLimits.requireWithin(
            req.fileSizeBytes(), r2Properties.getMaxUploadBytes(), "Photo");

        String tenantId = TenantContext.getTenant();
        String r2Key =
            tenantId + "/galleries/" + galleryId + "/" + UUID.randomUUID() + type.extension();

        DeliveryPhoto photo = new DeliveryPhoto(galleryId, r2Key, req.filename());
        photo.setTenantId(SecurityUtils.requireCurrentTenantId());
        // See PhotoService#initiateUpload: the signed Content-Length makes this
        // the size the object can have, rather than the size the client says it
        // had once the upload is already done.
        photo.setFileSizeBytes(sizeBytes);
        photo = deliveryPhotoRepository.save(photo);

        String uploadUrl = storage
            .orElseThrow(() -> new IllegalStateException("R2 storage not configured"))
            .generateUploadUrl(r2Key, type.contentType(), sizeBytes);
        return new InitiateUploadResponse(photo.getId(), r2Key, uploadUrl, type.contentType());
    }

    /** File size is fixed at initiate-time — see {@code PhotoService#completeUpload}. */
    @Transactional
    public DeliveryPhotoResponse completePhotoUpload(UUID photoId, CompleteUploadRequest req) {
        DeliveryPhoto photo = deliveryPhotoRepository.findById(photoId)
            .orElseThrow(() -> new NotFoundException("Photo not found: " + photoId));
        if (req.width() != null) {
            photo.setWidth(req.width());
        }
        if (req.height() != null) {
            photo.setHeight(req.height());
        }
        DeliveryPhoto saved = deliveryPhotoRepository.save(photo);

        // Thumbnail (always) and watermark (if the gallery asks for one) are
        // built off the request thread — the browser is already PUTting the
        // next file by the time this returns.
        String tenantId = TenantContext.getTenant();
        afterCommit(() -> photoProcessor.process(saved.getId(), tenantId));

        return toPhotoResponse(saved);
    }

    /**
     * Removes one delivered photo, and its derivatives, for good.
     *
     * <p>The row is deleted in this transaction; the objects are dropped only
     * once it has committed. Ordering the two statements inside a single
     * transaction would not have achieved that — the DELETE is not durable
     * until commit, so a commit failure after the objects were dropped leaves
     * the row alive pointing at bytes that are gone, and the client's gallery
     * lists a photo that 404s.
     *
     * <p>The remaining failure mode is the harmless one: if the object delete
     * fails after commit, the photo has still disappeared from the gallery and
     * what is left behind is an unreferenced blob costing storage.
     */
    @Transactional
    public void deletePhoto(UUID photoId, String ipAddress) {
        DeliveryPhoto photo = deliveryPhotoRepository.findById(photoId)
            .orElseThrow(() -> new NotFoundException("Photo not found: " + photoId));

        List<String> keys = derivativeKeys(photo);
        UUID galleryId = photo.getGalleryId();
        deliveryPhotoRepository.delete(photo);
        GalleryRemoval.deleteFilesAfterCommit(keys, storage, "photo " + photoId);

        auditService.log("GALLERY_PHOTO_DELETED", "GALLERY", galleryId,
            SecurityUtils.requireCurrentTenantId(), SecurityUtils.requireCurrentUserId(), ipAddress);
    }

    /**
     * Every object belonging to one photo. A watermarked copy has a thumbnail
     * of its own, so a photo can own up to four objects; absent ones are
     * filtered out by the storage layer.
     */
    private static List<String> derivativeKeys(DeliveryPhoto photo) {
        // Shared with the retention purge — see DeliveryPhotoKeys for why this
        // list must have exactly one definition.
        return DeliveryPhotoKeys.of(photo);
    }

    // ── public: view by token ────────────────────────────────────────────────

    /**
     * The token-addressed client view. The caller (controller) has already
     * resolved the tenant from the subdomain and bound it to TenantContext, so
     * the token lookup is RLS-scoped to that tenant. An expired gallery is
     * treated as not-found so the boundary never distinguishes "expired" from "never
     * existed" to an anonymous visitor.
     */
    @Transactional
    public PublicGalleryResponse getPublicByToken(String token, String photographerName) {
        Gallery gallery = galleryRepository.findByAccessToken(token)
            .orElseThrow(() -> new NotFoundException("Gallery not found"));

        if (!gallery.isReachable(OffsetDateTime.now(clock))) {
            // A tombstone rather than a 404 (ADR-001 §5). The token in this URL
            // is a 64-char capability secret, so whoever is reading this
            // already had the link — explaining that the gallery expired on a
            // given date leaks nothing and saves the photographer a support
            // ticket about a "broken" link.
            //
            // Note this covers a gallery that is still ACTIVE but past its
            // date: the sweep runs nightly, so for up to a day a lapsed
            // gallery would otherwise still serve photos.
            GalleryStatsView tombstone = requireStats(gallery.getId());
            return PublicGalleryResponse.expired(
                photographerName,
                tombstone.getBookingName(),
                tombstone.getEventType(),
                tombstone.getShootDate(),
                gallery.getExpiresAt(),
                brandingService.forTenant(gallery.getTenantId()));
        }

        galleryRepository.incrementViewCount(gallery.getId());

        // Read after the increment so the count the visitor sees includes
        // their own view, matching the previous behaviour.
        GalleryStatsView stats = requireStats(gallery.getId());
        boolean watermarked = Boolean.TRUE.equals(gallery.getWatermarkEnabled());
        List<DeliveryPhotoResponse> photos =
            deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(gallery.getId(), QueryLimits.LIST)
                .stream()
                .map(p -> watermarked ? toWatermarkedResponse(p) : toPhotoResponse(p))
                .filter(Objects::nonNull)
                .toList();

        return new PublicGalleryResponse(
            photographerName,
            stats.getBookingName(),
            stats.getEventType(),
            stats.getShootDate(),
            Boolean.TRUE.equals(gallery.getDownloadEnabled()),
            Boolean.TRUE.equals(gallery.getWatermarkEnabled()),
            gallery.getExpiresAt(),
            false,
            photos,
            // The studio's own mark on the surface its clients look at longest.
            brandingService.forTenant(gallery.getTenantId())
        );
    }

    /**
     * Resolves what the client's "download all" should contain.
     *
     * <p>Re-checks the token, the expiry and the download flag itself rather
     * than trusting that the caller already fetched the gallery: this endpoint
     * hands over every photo at once, so it is the one that most needs to
     * enforce its own preconditions. A gallery with downloads switched off is
     * reported as not-found, not as forbidden — the same reasoning as expiry,
     * so an anonymous visitor cannot use the response to learn that a valid
     * token exists.
     *
     * <p>Returns only the keys; the bytes are streamed afterwards outside any
     * transaction.
     */
    @Transactional(readOnly = true)
    public GalleryDownloadPlan prepareDownload(String token) {
        Gallery gallery = galleryRepository.findByAccessToken(token)
            .orElseThrow(() -> new NotFoundException("Gallery not found"));

        // Rate-limited per gallery, not per IP: the token IS the identity here
        // — the endpoint is unauthenticated and the recipients are a couple and
        // their family, on whatever networks they happen to be on.
        //
        // A whole-gallery ZIP is the most expensive response this product
        // produces: several gigabytes read out of object storage, streamed with
        // no async timeout (see spring.mvc.async.request-timeout) and holding a
        // request thread for its whole duration. Anyone holding the link can
        // start another one before the last has finished, and every restart
        // bills the full egress again. Twenty a day is far more than a real
        // client needs and far less than an accident or a leaked link costs.
        rateLimiter.check(
            "gallery:zip:" + gallery.getId(), DOWNLOAD_MAX_PER_DAY, DOWNLOAD_WINDOW,
            "This gallery has been downloaded several times today. "
                + "Please try again tomorrow, or contact your photographer.");

        if (!gallery.isReachable(OffsetDateTime.now(clock))) {
            // Not-found rather than a tombstone here: this endpoint streams
            // bytes, so there is nothing kind to return, and the existing
            // reasoning below applies unchanged.
            throw new NotFoundException("Gallery not found");
        }
        if (!Boolean.TRUE.equals(gallery.getDownloadEnabled())) {
            throw new NotFoundException("Gallery not found");
        }

        boolean watermarked = Boolean.TRUE.equals(gallery.getWatermarkEnabled());
        GalleryStatsView stats = requireStats(gallery.getId());

        Set<String> usedNames = new HashSet<>();
        List<GalleryDownloadPlan.Entry> entries = new ArrayList<>();
        for (DeliveryPhoto photo
                : deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(gallery.getId(), QueryLimits.LIST)) {
            // Same rule as the on-screen gallery: a watermarked delivery never
            // falls back to the original, so an unprocessed photo is omitted
            // rather than handed over clean.
            String key = watermarked ? photo.getWatermarkKey() : photo.getR2Key();
            if (key == null) {
                continue;
            }
            entries.add(new GalleryDownloadPlan.Entry(
                key, uniqueName(photo, key, watermarked, usedNames)));
        }

        return new GalleryDownloadPlan(archiveName(stats), entries);
    }

    /**
     * A ZIP with two members of the same name is a corrupt archive on some
     * tools and a silently-overwritten file on others, and cameras hand out
     * colliding names constantly — two bodies shooting the same wedding both
     * produce IMG_0001.JPG. Collisions get a numeric suffix.
     */
    private static String uniqueName(DeliveryPhoto photo, String key,
                                     boolean watermarked, Set<String> used) {
        String base = photo.getOriginalFilename() != null && !photo.getOriginalFilename().isBlank()
            ? sanitiseFilename(photo.getOriginalFilename())
            : photo.getId() + extractExtension(key);

        // Watermarked derivatives are re-encoded as JPEG, so a delivery
        // uploaded as .png would otherwise carry a name its bytes contradict.
        if (watermarked) {
            int dot = base.lastIndexOf('.');
            base = (dot >= 0 ? base.substring(0, dot) : base) + ".jpg";
        }

        if (used.add(base)) {
            return base;
        }
        int dot = base.lastIndexOf('.');
        String stem = dot >= 0 ? base.substring(0, dot) : base;
        String ext = dot >= 0 ? base.substring(dot) : "";
        for (int i = 2; ; i++) {
            String candidate = stem + " (" + i + ")" + ext;
            if (used.add(candidate)) {
                return candidate;
            }
        }
    }

    /**
     * Strips anything that would let an entry name escape the archive root or
     * confuse an extractor — a path separator in a ZIP entry is the classic
     * Zip-Slip write-outside-the-target bug, and the name here comes from a
     * file the photographer uploaded.
     */
    private static String sanitiseFilename(String filename) {
        String cleaned = filename
            .replace('\\', '_')
            .replace('/', '_')
            .replaceAll("\\p{Cntrl}", "")
            // Separators are what actually make traversal work, so the name is
            // already inert by this point; the dot-dot runs are collapsed too
            // so nothing downstream has to reason about whether they matter.
            .replaceAll("\\.{2,}", "_")
            .trim();
        while (cleaned.startsWith(".")) {
            cleaned = cleaned.substring(1);
        }
        return cleaned.isBlank() ? "photo.jpg" : cleaned;
    }

    private static String archiveName(GalleryStatsView stats) {
        String base = stats.getBookingName() != null && !stats.getBookingName().isBlank()
            ? stats.getBookingName()
            : "gallery";
        String slug = sanitiseFilename(base)
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("(^-|-$)", "");
        return (slug.isBlank() ? "gallery" : slug) + "-photos.zip";
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /**
     * Defers work until the surrounding transaction has actually committed.
     *
     * <p>An {@code @Async} call made inline starts running immediately, on
     * another thread, while this transaction is still open — so the worker
     * reads the row as it was *before* this method's writes, and any save it
     * makes can overwrite them. It also runs at all when the transaction is
     * about to roll back, leaving derivatives for a photo that no longer
     * exists.
     *
     * <p>Falls through to running inline when there is no active transaction,
     * so unit tests and any non-transactional caller behave the same.
     */
    private static void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(
            new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
    }

    private GalleryStatsView requireStats(UUID id) {
        return galleryRepository.findStatsById(id)
            .orElseThrow(() -> new NotFoundException("Gallery not found: " + id));
    }

    private void audit(String action, UUID galleryId, String ipAddress) {
        auditService.log(action, "GALLERY", galleryId,
            SecurityUtils.requireCurrentTenantId(), SecurityUtils.requireCurrentUserId(), ipAddress);
    }

    private String presignedUrl(String r2Key) {
        return storage.map(s -> s.generateDownloadUrl(r2Key)).orElse(null);
    }

    /**
     * The thumbnail a client sees for a gallery: its first photo, through the
     * same watermark rule as the public view — the portal must not become the
     * way round it. Null when there is nothing to show yet, including a
     * watermarked gallery whose first photo has not been processed.
     */
    String clientCoverUrl(Gallery gallery) {
        boolean watermarked = Boolean.TRUE.equals(gallery.getWatermarkEnabled());
        return deliveryPhotoRepository
            .findByGalleryIdOrderBySortOrderAsc(gallery.getId(), Limit.of(1))
            .stream()
            .findFirst()
            .map(p -> watermarked ? toWatermarkedResponse(p) : toPhotoResponse(p))
            .map(DeliveryPhotoResponse::thumbnailUrl)
            .orElse(null);
    }

    /**
     * The client's view of a photo in a watermarked gallery.
     *
     * <p>Returns null — and the caller drops the photo — when the watermarked
     * derivative does not exist yet. That is the whole point: the alternative
     * is falling back to {@code r2Key}, which is the untouched original, so a
     * gallery would hand out clean files during the seconds between upload and
     * processing, and permanently for any photo whose processing failed. A
     * photo that briefly does not appear is recoverable; one that was
     * downloaded unmarked is not.
     */
    private DeliveryPhotoResponse toWatermarkedResponse(DeliveryPhoto p) {
        if (p.getWatermarkKey() == null) {
            return null;
        }
        String viewUrl = presignedUrl(p.getWatermarkKey());
        String thumbUrl = presignedUrl(ThumbnailService.thumbnailKeyFor(p.getWatermarkKey()));
        return new DeliveryPhotoResponse(
            p.getId(),
            viewUrl,
            thumbUrl == null ? viewUrl : thumbUrl,
            p.getOriginalFilename(),
            p.getFileSizeBytes(),
            p.getWidth(),
            p.getHeight(),
            p.getSortOrder() == null ? 0 : p.getSortOrder()
        );
    }

    /** The photographer's own view: always their untouched originals. */
    private DeliveryPhotoResponse toPhotoResponse(DeliveryPhoto p) {
        String viewUrl = presignedUrl(p.getR2Key());
        String thumbUrl = p.getThumbnailKey() != null ? presignedUrl(p.getThumbnailKey()) : viewUrl;
        return new DeliveryPhotoResponse(
            p.getId(),
            viewUrl,
            thumbUrl,
            p.getOriginalFilename(),
            p.getFileSizeBytes(),
            p.getWidth(),
            p.getHeight(),
            p.getSortOrder() == null ? 0 : p.getSortOrder()
        );
    }

    private static GalleryResponse toResponse(GalleryStatsView v) {
        return new GalleryResponse(
            v.getId(),
            v.getBookingId(),
            v.getBookingName(),
            v.getEventType(),
            v.getShootDate(),
            v.getPhotoCount() == null ? 0 : v.getPhotoCount().intValue(),
            v.getDownloadEnabled(),
            v.getWatermarkEnabled(),
            v.getExpiresAt() == null ? null : OffsetDateTime.ofInstant(v.getExpiresAt(), ZoneOffset.UTC),
            v.getAccessToken(),
            v.getViewCount(),
            v.getCreatedAt() == null ? null : OffsetDateTime.ofInstant(v.getCreatedAt(), ZoneOffset.UTC),
            v.getExpiryState(),
            v.getRetentionDays(),
            v.getPurgeAfter() == null ? null : OffsetDateTime.ofInstant(v.getPurgeAfter(), ZoneOffset.UTC),
            v.getExtensionCount(),
            GalleryExpiryState.from(v.getExpiryState()) != GalleryExpiryState.PURGED
        );
    }

    private static String extractExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : "";
    }
}
