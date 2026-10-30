package com.photographplatform.api.pricing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Create / update payload for a package. Currency defaults to EUR at the entity
 * level when omitted. {@code active} and {@code sortOrder} are nullable in the
 * DTO so PATCH semantics can leave them untouched; the service substitutes
 * sensible defaults on create.
 */
public record PackageRequest(
    @NotBlank(message = "Package name is required")
    @Size(max = 200, message = "Package name must be at most 200 characters")
    String name,

    @NotNull(message = "Price is required")
    @PositiveOrZero(message = "Price cannot be negative")
    Integer priceCents,

    @Size(min = 3, max = 3, message = "Currency must be a 3-letter ISO code")
    String currency,

    @PositiveOrZero(message = "Duration cannot be negative")
    BigDecimal durationHours,

    @PositiveOrZero(message = "Included photos cannot be negative")
    Integer includedPhotos,

    Boolean active,

    Integer sortOrder
) {}
