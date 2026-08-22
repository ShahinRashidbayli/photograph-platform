package com.photographplatform.api.gallery.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record GalleryResponse(
    UUID id,
    UUID bookingId,
    String bookingName,
    String eventType,
    LocalDate shootDate,
    Integer photoCount,
    Boolean downloadEnabled,
    Boolean watermarkEnabled,
    OffsetDateTime expiresAt,
    String accessToken,
    Integer viewCount,
    OffsetDateTime createdAt,
    // Retention (ADR-001). The dashboard already counted down to expiresAt;
    // these let it say *what happens next* — whether the gallery is still
    // live, sitting in its recoverable grace period, or gone — and whether
    // "Extend" is worth offering.
    String expiryState,
    Integer retentionDays,
    OffsetDateTime purgeAfter,
    Integer extensionCount,
    boolean canExtend
) {}
