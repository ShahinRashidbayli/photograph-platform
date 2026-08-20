package com.photographplatform.api.gallery.controller;

import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.gallery.dto.CreateGalleryRequest;
import com.photographplatform.api.gallery.dto.DeliveryPhotoResponse;
import com.photographplatform.api.gallery.dto.GalleryResponse;
import com.photographplatform.api.gallery.dto.PublicGalleryResponse;
import com.photographplatform.api.gallery.dto.UpdateGalleryRequest;
import com.photographplatform.api.gallery.service.GalleryService;
import com.photographplatform.api.portfolio.dto.CompleteUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadResponse;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
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

    private final GalleryService galleryService;
    private final PublicTenantResolver tenantResolver;

    public GalleryController(GalleryService galleryService, PublicTenantResolver tenantResolver) {
        this.galleryService = galleryService;
        this.tenantResolver = tenantResolver;
    }

    // ── owner ────────────────────────────────────────────────────────────────

    @GetMapping("/galleries")
    public ResponseEntity<List<GalleryResponse>> listGalleries() {
        return ResponseEntity.ok(galleryService.listAll());
    }

    @PostMapping("/galleries")
    public ResponseEntity<GalleryResponse> create(
        @Valid @RequestBody CreateGalleryRequest request,
        HttpServletRequest http
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(galleryService.create(request, ClientIp.from(http)));
    }

    @PatchMapping("/galleries/{id}")
    public ResponseEntity<GalleryResponse> update(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateGalleryRequest request,
        HttpServletRequest http
    ) {
        return ResponseEntity.ok(galleryService.update(id, request, ClientIp.from(http)));
    }

    @DeleteMapping("/galleries/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, HttpServletRequest http) {
        galleryService.delete(id, ClientIp.from(http));
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
     * tenant, and the token authorises the specific gallery within it.
     */
    @GetMapping("/public/galleries/{subdomain}/{token}")
    public ResponseEntity<PublicGalleryResponse> getPublicGallery(
        @PathVariable String subdomain,
        @PathVariable String token
    ) {
        var photographer = tenantResolver.requirePhotographer(subdomain);
        return ResponseEntity.ok(tenantResolver.inTenantContext(
            photographer.tenant(),
            () -> galleryService.getPublicByToken(token, photographer.displayName())));
    }
}
