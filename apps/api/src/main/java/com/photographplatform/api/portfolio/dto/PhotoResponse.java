package com.photographplatform.api.portfolio.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PhotoResponse(
    UUID id,
    UUID categoryId,
    String viewUrl,
    String thumbnailUrl,
    Long fileSizeBytes,
    Integer width,
    Integer height,
    int sortOrder,
    boolean published,
    OffsetDateTime createdAt
) {
}
