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
    OffsetDateTime createdAt
) {}
