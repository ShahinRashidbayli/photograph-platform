package com.photographplatform.api.gallery.dto;

import java.util.UUID;

/**
 * One delivered photo. {@code viewUrl}/{@code thumbnailUrl} are short-lived
 * presigned R2 GET URLs; they are null when object storage is not configured
 * (local dev without R2 credentials), so callers must tolerate a missing image
 * rather than assume a URL is always present.
 */
public record DeliveryPhotoResponse(
    UUID id,
    String viewUrl,
    String thumbnailUrl,
    String originalFilename,
    Long fileSizeBytes,
    Integer width,
    Integer height,
    int sortOrder
) {}
