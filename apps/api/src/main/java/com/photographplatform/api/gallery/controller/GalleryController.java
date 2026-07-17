package com.photographplatform.api.gallery.controller;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.gallery.dto.CreateGalleryRequest;
import com.photographplatform.api.gallery.dto.DeliveryPhotoResponse;
import com.photographplatform.api.gallery.dto.GalleryResponse;
import com.photographplatform.api.gallery.dto.PublicGalleryResponse;
import com.photographplatform.api.gallery.dto.UpdateGalleryRequest;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository.GalleryStatsView;
import com.photographplatform.api.gallery.service.GalleryService;
import com.photographplatform.api.portfolio.dto.CompleteUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadResponse;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class GalleryController {

    private final GalleryRepository galleryRepository;
    private final GalleryService galleryService;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;

    public GalleryController(GalleryRepository galleryRepository,
                             GalleryService galleryService,
                             TenantRepository tenantRepository,
                             UserRepository userRepository) {
        this.galleryRepository = galleryRepository;
        this.galleryService = galleryService;
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
    }

    // ── owner ────────────────────────────────────────────────────────────────

    @GetMapping("/galleries")
    public ResponseEntity<List<GalleryResponse>> listGalleries() {
        List<GalleryResponse> galleries = galleryRepository.findAllWithStats().stream()
            .map(GalleryController::toResponse)
            .toList();
        return ResponseEntity.ok(galleries);
    }

    @PostMapping("/galleries")
    public ResponseEntity<GalleryResponse> create(
        @Valid @RequestBody CreateGalleryRequest request,
        HttpServletRequest http
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(galleryService.create(request, http.getRemoteAddr()));
    }

    @PatchMapping("/galleries/{id}")
    public ResponseEntity<GalleryResponse> update(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateGalleryRequest request,
        HttpServletRequest http
    ) {
        return ResponseEntity.ok(galleryService.update(id, request, http.getRemoteAddr()));
    }

    @DeleteMapping("/galleries/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, HttpServletRequest http) {
        galleryService.delete(id, http.getRemoteAddr());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/galleries/{id}/photos")
    public ResponseEntity<List<DeliveryPhotoResponse>> listPhotos(@PathVariable UUID id) {
        return ResponseEntity.ok(galleryService.listPhotos(id));
    }

    @PostMapping("/galleries/{id}/photos/initiate-upload")
    public ResponseEntity<InitiateUploadResponse> initiateUpload(
        @PathVariable UUID id,
        @Valid @RequestBody InitiateUploadRequest request
    ) {
        return ResponseEntity.ok(galleryService.initiatePhotoUpload(id, request));
    }

    @PostMapping("/galleries/photos/{photoId}/complete")
    public ResponseEntity<DeliveryPhotoResponse> completeUpload(
        @PathVariable UUID photoId,
        @RequestBody CompleteUploadRequest request
    ) {
        return ResponseEntity.ok(galleryService.completePhotoUpload(photoId, request));
    }

    // ── public (token-addressed client view) ─────────────────────────────────

    /**
     * The client's gallery. Unauthenticated: the {@code subdomain} resolves the
     * tenant (the token alone can't, since galleries live in per-tenant
     * schemas), and the token then authorises the specific gallery within it.
     * TenantContext is set manually for the duration of the call, mirroring the
     * public portfolio endpoint.
     */
    @GetMapping("/public/galleries/{subdomain}/{token}")
    public ResponseEntity<PublicGalleryResponse> getPublicGallery(
        @PathVariable String subdomain,
        @PathVariable String token
    ) {
        Tenant tenant = tenantRepository.findBySubdomain(subdomain)
            .orElseThrow(() -> new NotFoundException("Photographer not found: " + subdomain));

        User owner = userRepository.findByEmail(tenant.getOwnerEmail()).orElse(null);
        String photographerName = owner != null && owner.getFullName() != null
            ? owner.getFullName()
            : tenant.getSubdomain();

        TenantContext.setTenant(tenant.getId().toString());
        try {
            return ResponseEntity.ok(galleryService.getPublicByToken(token, photographerName));
        } finally {
            TenantContext.clear();
        }
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
}
