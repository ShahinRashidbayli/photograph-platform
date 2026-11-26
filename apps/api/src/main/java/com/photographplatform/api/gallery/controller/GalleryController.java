package com.photographplatform.api.gallery.controller;

import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.gallery.dto.CreateGalleryRequest;
import com.photographplatform.api.gallery.dto.DeliveryPhotoResponse;
import com.photographplatform.api.gallery.dto.GalleryResponse;
import com.photographplatform.api.gallery.dto.PublicGalleryResponse;
import com.photographplatform.api.gallery.dto.SendGalleryRequest;
import com.photographplatform.api.gallery.dto.UpdateGalleryRequest;
import com.photographplatform.api.gallery.dto.GalleryDownloadPlan;
import com.photographplatform.api.gallery.service.GalleryArchiveWriter;
import com.photographplatform.api.gallery.service.GalleryService;
import com.photographplatform.api.portfolio.dto.CompleteUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadResponse;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api")
public class GalleryController {

    private final GalleryService galleryService;
    private final PublicTenantResolver tenantResolver;
    private final GalleryArchiveWriter archiveWriter;

    public GalleryController(GalleryService galleryService,
                             PublicTenantResolver tenantResolver,
                             GalleryArchiveWriter archiveWriter) {
        this.galleryService = galleryService;
        this.tenantResolver = tenantResolver;
        this.archiveWriter = archiveWriter;
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

    /**
     * Extends a gallery by one plan-sized retention window (ADR-001 §4.2).
     *
     * <p>Its own endpoint rather than a field on PATCH: the photographer picks
     * *that it should live longer*, not *how long*, because the window is what
     * the plan sells. It also has to work on a gallery that already lapsed,
     * which is a recovery action, not a settings edit.
     */
    @PostMapping("/galleries/{id}/extend")
    public ResponseEntity<GalleryResponse> extend(
        @PathVariable UUID id, HttpServletRequest http) {
        return ResponseEntity.ok(galleryService.extend(id, ClientIp.from(http)));
    }

    /**
     * "An Kunden senden": emails the booking's Customer a link to the gallery.
     * 409 while it has no photos; can be sent again. The body is optional:
     * {@code { "note": "…" }}, the photographer's personal note.
     */
    @PostMapping("/galleries/{id}/send")
    public ResponseEntity<GalleryResponse> send(
        @PathVariable UUID id,
        @Valid @RequestBody(required = false) SendGalleryRequest request,
        HttpServletRequest http
    ) {
        String note = request == null ? null : request.note();
        return ResponseEntity.ok(galleryService.send(id, note, ClientIp.from(http)));
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

    /**
     * Deletes one delivered photo and its derivatives. Scoped to the caller's
     * tenant by RLS, so a photo id from another photographer's gallery simply
     * does not resolve.
     */
    @DeleteMapping("/galleries/photos/{photoId}")
    public ResponseEntity<Void> deletePhoto(@PathVariable UUID photoId, HttpServletRequest http) {
        galleryService.deletePhoto(photoId, ClientIp.from(http));
        return ResponseEntity.noContent().build();
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

    /**
     * Downloads the whole gallery as a ZIP.
     *
     * <p>Streamed rather than assembled: the body is written straight to the
     * socket as each photo is read from object storage, so a multi-gigabyte
     * delivery costs one buffer instead of a temp file or a heap full of
     * images. That is also why the response carries no Content-Length — the
     * total is not known until the last entry is written, and browsers handle
     * a chunked download of unknown size fine.
     */
    @GetMapping("/public/galleries/{subdomain}/{token}/download")
    public ResponseEntity<StreamingResponseBody> downloadGallery(
        @PathVariable String subdomain,
        @PathVariable String token
    ) {
        var photographer = tenantResolver.requirePhotographer(subdomain);

        // Resolved inside the tenant context, before streaming starts, so any
        // rejection (bad token, expired, downloads disabled) still becomes a
        // clean 404 — once the first byte is written the status is fixed.
        GalleryDownloadPlan plan = tenantResolver.inTenantContext(
            photographer.tenant(), () -> galleryService.prepareDownload(token));

        StreamingResponseBody body = out -> archiveWriter.writeTo(plan, out);

        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                .filename(plan.archiveName())
                .build()
                .toString())
            .body(body);
    }
}
