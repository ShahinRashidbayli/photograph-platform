package com.photographplatform.api.gallery.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * Create a delivery gallery for a booking.
 *
 * <p>There is deliberately no {@code expiresAt} field. Retention is derived
 * server-side from the tenant's plan the moment the gallery is delivered
 * (ADR-001 §2/§4) — it is one of the two things the plans actually sell, so
 * accepting it from the browser would let any tenant grant itself Studio's two
 * years. The toggles default to download-on / watermark-off when omitted,
 * matching the column defaults.
 */
public record CreateGalleryRequest(
    @NotNull(message = "bookingId is required")
    UUID bookingId,
    Boolean downloadEnabled,
    Boolean watermarkEnabled
) {}
