package com.photographplatform.api.portfolio.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CategoryResponse(
    UUID id,
    String name,
    int sortOrder,
    OffsetDateTime createdAt
) {
}
