package com.photographplatform.api.gallery.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.dto.CreateGalleryRequest;
import com.photographplatform.api.gallery.dto.DeliveryPhotoResponse;
import com.photographplatform.api.gallery.dto.GalleryResponse;
import com.photographplatform.api.gallery.dto.PublicGalleryResponse;
import com.photographplatform.api.gallery.dto.UpdateGalleryRequest;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository.GalleryStatsView;
import com.photographplatform.api.portfolio.dto.CompleteUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadResponse;
import com.photographplatform.api.portfolio.service.R2StorageService;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gallery management for the photographer, plus the token-addressed public
 * view for the client. Delivery photos reuse the portfolio's R2 presign flow,
 * so — exactly like the portfolio — object URLs are only produced when R2 is
 * configured; without it the rows still round-trip with null image URLs.
 */
@Service
public class GalleryService {

    private final GalleryRepository galleryRepository;
    private final DeliveryPhotoRepository deliveryPhotoRepository;
    private final BookingRepository bookingRepository;
    private final Optional<R2StorageService> storage;
    private final AuditService auditService;

    public GalleryService(GalleryRepository galleryRepository,
                          DeliveryPhotoRepository deliveryPhotoRepository,
                          BookingRepository bookingRepository,
                          Optional<R2StorageService> storage,
                          AuditService auditService) {
        this.galleryRepository = galleryRepository;
        this.deliveryPhotoRepository = deliveryPhotoRepository;
        this.bookingRepository = bookingRepository;
        this.storage = storage;
        this.auditService = auditService;
    }

    // ── owner: manage ──────────────────────────────────────────────────────

    @Transactional
    public GalleryResponse create(CreateGalleryRequest req, String ipAddress) {
        if (!bookingRepository.existsById(req.bookingId())) {
            throw new NotFoundException("Booking not found: " + req.bookingId());
        }
        Gallery gallery = galleryRepository.save(new Gallery(
            req.bookingId(),
            req.expiresAt(),
            req.downloadEnabled() == null ? true : req.downloadEnabled(),
            req.watermarkEnabled() == null ? false : req.watermarkEnabled()
        ));
        audit("GALLERY_CREATED", gallery.getId(), ipAddress);
        return toResponse(requireStats(gallery.getId()));
    }

    @Transactional
    public GalleryResponse update(UUID id, UpdateGalleryRequest req, String ipAddress) {
        Gallery gallery = galleryRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Gallery not found: " + id));
        if (req.expiresAt() != null) {
            gallery.setExpiresAt(req.expiresAt());
        }
        if (req.downloadEnabled() != null) {
            gallery.setDownloadEnabled(req.downloadEnabled());
        }
        if (req.watermarkEnabled() != null) {
            gallery.setWatermarkEnabled(req.watermarkEnabled());
        }
        galleryRepository.save(gallery);
        audit("GALLERY_UPDATED", id, ipAddress);
        return toResponse(requireStats(id));
    }

    @Transactional
    public void delete(UUID id, String ipAddress) {
        if (!galleryRepository.existsById(id)) {
            throw new NotFoundException("Gallery not found: " + id);
        }
        // delivery_photos are removed by the ON DELETE CASCADE foreign key.
        galleryRepository.deleteById(id);
        audit("GALLERY_DELETED", id, ipAddress);
    }

    @Transactional(readOnly = true)
    public List<DeliveryPhotoResponse> listPhotos(UUID galleryId) {
        if (!galleryRepository.existsById(galleryId)) {
            throw new NotFoundException("Gallery not found: " + galleryId);
        }
        return deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(galleryId)
            .stream()
            .map(this::toPhotoResponse)
            .toList();
    }

    // ── owner: upload ──────────────────────────────────────────────────────

    @Transactional
    public InitiateUploadResponse initiatePhotoUpload(UUID galleryId, InitiateUploadRequest req) {
        if (!galleryRepository.existsById(galleryId)) {
            throw new NotFoundException("Gallery not found: " + galleryId);
        }
        String tenantId = TenantContext.getTenant();
        String extension = extractExtension(req.filename());
        String r2Key = tenantId + "/galleries/" + galleryId + "/" + UUID.randomUUID() + extension;

        DeliveryPhoto photo = deliveryPhotoRepository.save(
            new DeliveryPhoto(galleryId, r2Key, req.filename()));

        String uploadUrl = storage
            .orElseThrow(() -> new IllegalStateException("R2 storage not configured"))
            .generateUploadUrl(r2Key, req.contentType());
        return new InitiateUploadResponse(photo.getId(), r2Key, uploadUrl);
    }

    @Transactional
    public DeliveryPhotoResponse completePhotoUpload(UUID photoId, CompleteUploadRequest req) {
        DeliveryPhoto photo = deliveryPhotoRepository.findById(photoId)
            .orElseThrow(() -> new NotFoundException("Photo not found: " + photoId));
        if (req.fileSizeBytes() != null) {
            photo.setFileSizeBytes(req.fileSizeBytes());
        }
        if (req.width() != null) {
            photo.setWidth(req.width());
        }
        if (req.height() != null) {
            photo.setHeight(req.height());
        }
        return toPhotoResponse(deliveryPhotoRepository.save(photo));
    }

    // ── public: view by token ────────────────────────────────────────────────

    /**
     * The token-addressed client view. The caller (controller) has already
     * resolved the tenant from the subdomain and set the search_path, so the
     * token lookup runs inside the right schema. An expired gallery is treated
     * as not-found so the boundary never distinguishes "expired" from "never
     * existed" to an anonymous visitor.
     */
    @Transactional
    public PublicGalleryResponse getPublicByToken(String token, String photographerName) {
        Gallery gallery = galleryRepository.findByAccessToken(token)
            .orElseThrow(() -> new NotFoundException("Gallery not found"));

        if (gallery.getExpiresAt() != null
            && gallery.getExpiresAt().isBefore(OffsetDateTime.now(ZoneOffset.UTC))) {
            throw new NotFoundException("Gallery not found");
        }

        gallery.incrementViewCount();
        galleryRepository.save(gallery);

        GalleryStatsView stats = requireStats(gallery.getId());
        List<DeliveryPhotoResponse> photos =
            deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(gallery.getId())
                .stream()
                .map(this::toPhotoResponse)
                .toList();

        return new PublicGalleryResponse(
            photographerName,
            stats.getBookingName(),
            stats.getEventType(),
            stats.getShootDate(),
            Boolean.TRUE.equals(gallery.getDownloadEnabled()),
            Boolean.TRUE.equals(gallery.getWatermarkEnabled()),
            gallery.getExpiresAt(),
            photos
        );
    }

    // ── helpers ──────────────────────────────────────────────────────────────

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
            v.getCreatedAt() == null ? null : OffsetDateTime.ofInstant(v.getCreatedAt(), ZoneOffset.UTC)
        );
    }

    private static String extractExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : "";
    }
}
