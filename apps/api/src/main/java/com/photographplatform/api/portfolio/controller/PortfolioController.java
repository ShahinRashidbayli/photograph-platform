package com.photographplatform.api.portfolio.controller;

import com.photographplatform.api.common.security.RequiresVerifiedEmail;
import com.photographplatform.api.portfolio.dto.CompleteUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadResponse;
import com.photographplatform.api.portfolio.dto.PhotoResponse;
import com.photographplatform.api.portfolio.dto.PublicPortfolioResponse;
import com.photographplatform.api.portfolio.dto.UpdatePhotoCategoryRequest;
import com.photographplatform.api.portfolio.service.PhotoService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
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
public class PortfolioController {

    private final PhotoService photoService;
    private final PublicTenantResolver tenantResolver;

    public PortfolioController(PhotoService photoService, PublicTenantResolver tenantResolver) {
        this.photoService = photoService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping("/public/portfolio/{subdomain}")
    public ResponseEntity<PublicPortfolioResponse> getPublicPortfolio(@PathVariable String subdomain) {
        var photographer = tenantResolver.requirePhotographer(subdomain);
        Tenant tenant = photographer.tenant();

        return ResponseEntity.ok(tenantResolver.inTenantContext(tenant, () -> {
            List<PhotoResponse> photos = photoService.listPublished();
            return new PublicPortfolioResponse(
                new PublicPortfolioResponse.PhotographerPublic(
                    tenant.getSubdomain(),
                    photographer.displayName(),
                    tenant.getPlan(),
                    photographer.avatarUrl()
                ),
                photos
            );
        }));
    }

    @GetMapping("/portfolio/photos")
    public ResponseEntity<List<PhotoResponse>> listAll() {
        List<PhotoResponse> photos = photoService.listAll();
        return ResponseEntity.ok(photos);
    }

    /**
     * Step 1 of upload: client supplies filename + content-type, we mint a
     * tenant-scoped R2 key, persist a placeholder Photo row, and return a
     * pre-signed PUT URL. The browser uploads directly to R2 from there.
     */
    @PostMapping("/portfolio/photos/initiate-upload")
    public ResponseEntity<InitiateUploadResponse> initiateUpload(
        @Valid @RequestBody InitiateUploadRequest request
    ) {
        InitiateUploadResponse response = photoService.initiateUpload(request, null);
        return ResponseEntity.ok(response);
    }

    /**
     * Step 2 of upload: client tells us the PUT to R2 succeeded. We update
     * the Photo with file metadata and tetiklenir thumbnail generation off
     * the request thread. Returns the updated photo immediately — the
     * thumbnailUrl will populate once the async job lands (a few seconds
     * later, polled by the FE or shown on next page load).
     */
    @PostMapping("/portfolio/photos/{id}/complete")
    public ResponseEntity<PhotoResponse> completeUpload(
        @PathVariable UUID id,
        @RequestBody(required = false) CompleteUploadRequest request
    ) {
        CompleteUploadRequest body = request != null
            ? request
            : new CompleteUploadRequest(null, null);
        PhotoResponse photo = photoService.completeUpload(id, body);
        return ResponseEntity.ok(photo);
    }

    // Publishing makes the photo public on the photographer's portfolio URL.
    // Gating on verified email avoids unverified accounts pushing content under
    // their identity before they prove ownership of the inbox.
    @RequiresVerifiedEmail
    @PostMapping("/portfolio/photos/{id}/publish")
    public ResponseEntity<PhotoResponse> publishPhoto(@PathVariable UUID id) {
        PhotoResponse photo = photoService.publish(id);
        return ResponseEntity.ok(photo);
    }

    // Return a published photo to draft — the inverse of publish. Same verified-
    // email gate for symmetry (both change what the public page shows).
    @RequiresVerifiedEmail
    @PostMapping("/portfolio/photos/{id}/unpublish")
    public ResponseEntity<PhotoResponse> unpublishPhoto(@PathVariable UUID id) {
        PhotoResponse photo = photoService.unpublish(id);
        return ResponseEntity.ok(photo);
    }

    // Assign or clear a photo's category. Not gated on verified email: it only
    // reorganises the owner's own library, it doesn't push new public content.
    @PatchMapping("/portfolio/photos/{id}/category")
    public ResponseEntity<PhotoResponse> setPhotoCategory(
        @PathVariable UUID id,
        @RequestBody UpdatePhotoCategoryRequest request
    ) {
        return ResponseEntity.ok(photoService.setCategory(id, request.categoryId()));
    }

    @DeleteMapping("/portfolio/photos/{id}")
    public ResponseEntity<Void> deletePhoto(@PathVariable UUID id) {
        photoService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
