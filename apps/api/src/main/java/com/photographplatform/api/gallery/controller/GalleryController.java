package com.photographplatform.api.gallery.controller;

import com.photographplatform.api.gallery.dto.GalleryResponse;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository.GalleryStatsView;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class GalleryController {

    private final GalleryRepository galleryRepository;

    public GalleryController(GalleryRepository galleryRepository) {
        this.galleryRepository = galleryRepository;
    }

    @GetMapping("/galleries")
    public ResponseEntity<List<GalleryResponse>> listGalleries() {
        List<GalleryResponse> galleries = galleryRepository.findAllWithStats().stream()
            .map(GalleryController::toResponse)
            .toList();
        return ResponseEntity.ok(galleries);
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
