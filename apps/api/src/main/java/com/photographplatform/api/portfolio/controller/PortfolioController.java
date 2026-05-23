package com.photographplatform.api.portfolio.controller;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.security.RequiresVerifiedEmail;
import com.photographplatform.api.portfolio.dto.CompleteUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadResponse;
import com.photographplatform.api.portfolio.dto.PhotoResponse;
import com.photographplatform.api.portfolio.dto.PublicPortfolioResponse;
import com.photographplatform.api.portfolio.service.PhotoService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PortfolioController {

    private final PhotoService photoService;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;

    public PortfolioController(PhotoService photoService, TenantRepository tenantRepository,
                               UserRepository userRepository) {
        this.photoService = photoService;
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/public/portfolio/{subdomain}")
    public ResponseEntity<PublicPortfolioResponse> getPublicPortfolio(@PathVariable String subdomain) {
        Tenant tenant = tenantRepository.findBySubdomain(subdomain)
            .orElseThrow(() -> new NotFoundException("Photographer not found: " + subdomain));

        // Owner display name lives on the OWNER user (not the tenant). Email is
        // the canonical link. Missing owner is treated as "incomplete profile"
        // — the public page renders a neutral fallback instead of 500-ing.
        User owner = userRepository.findByEmail(tenant.getOwnerEmail()).orElse(null);
        String displayName = owner != null && owner.getFullName() != null
            ? owner.getFullName()
            : tenant.getSubdomain();
        String avatarUrl = owner != null ? owner.getAvatarUrl() : null;

        TenantContext.setTenant(tenant.getId().toString());
        try {
            List<PhotoResponse> photos = photoService.listPublished();
            var photographer = new PublicPortfolioResponse.PhotographerPublic(
                tenant.getSubdomain(),
                displayName,
                tenant.getPlan(),
                avatarUrl
            );
            return ResponseEntity.ok(new PublicPortfolioResponse(photographer, photos));
        } finally {
            TenantContext.clear();
        }
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
            : new CompleteUploadRequest(null, null, null);
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

    @DeleteMapping("/portfolio/photos/{id}")
    public ResponseEntity<Void> deletePhoto(@PathVariable UUID id) {
        photoService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
