package com.photographplatform.api.gallery.dto;

import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Create a delivery gallery for a booking. {@code expiresAt} is optional — a
 * null means "no expiry yet" (the retention job in ADR-001 will later default
 * it from the plan). The toggles default to download-on / watermark-off when
 * omitted, matching the column defaults.
 */
public record CreateGalleryRequest(
    @NotNull(message = "bookingId is required")
    UUID bookingId,
    OffsetDateTime expiresAt,
    Boolean downloadEnabled,
    Boolean watermarkEnabled
) {}
