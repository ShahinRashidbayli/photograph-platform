package com.photographplatform.api.pricing.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record PackageResponse(
    UUID id,
    String name,
    Integer priceCents,
    String currency,
    BigDecimal durationHours,
    Integer includedPhotos,
    boolean active,
    int sortOrder
) {}
