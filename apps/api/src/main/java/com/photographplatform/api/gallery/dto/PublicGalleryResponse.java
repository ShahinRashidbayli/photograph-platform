package com.photographplatform.api.gallery.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * The client-facing gallery, served by access token with no authentication.
 * Deliberately narrow: it exposes only what the recipient needs to view and
 * download their photos — the photographer's display name, the shoot context,
 * the download flag and the photos themselves. No booking id, client email,
 * view count or other tenant PII crosses this boundary.
 */
public record PublicGalleryResponse(
    String photographerName,
    String bookingName,
    String eventType,
    LocalDate shootDate,
    boolean downloadEnabled,
    boolean watermarkEnabled,
    OffsetDateTime expiresAt,
    List<DeliveryPhotoResponse> photos
) {}
