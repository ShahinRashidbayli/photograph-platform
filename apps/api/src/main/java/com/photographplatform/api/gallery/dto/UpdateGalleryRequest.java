package com.photographplatform.api.gallery.dto;

import java.time.OffsetDateTime;

/**
 * Partial update of a gallery's delivery settings. Every field is optional; a
 * null leaves that setting unchanged, so the same route serves "extend expiry",
 * "toggle downloads" and "toggle watermark" without separate endpoints.
 */
public record UpdateGalleryRequest(
    OffsetDateTime expiresAt,
    Boolean downloadEnabled,
    Boolean watermarkEnabled
) {}
