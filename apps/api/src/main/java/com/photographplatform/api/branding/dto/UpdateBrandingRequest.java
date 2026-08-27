package com.photographplatform.api.branding.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Both fields are nullable, and null means "clear it" rather than "leave it" —
 * the settings form always sends its whole state, so a partial update would
 * make removing a logo impossible.
 *
 * @param logoKey    R2 object key from the presign endpoint, or null to remove
 * @param brandColor `#RRGGBB` or null. Validated here rather than in the
 *                   database: the value reaches it from this one endpoint, and
 *                   a CHECK constraint on a hex string is a migration nobody
 *                   wants to run twice
 */
public record UpdateBrandingRequest(
    @Size(max = 500) String logoKey,
    @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "brandColor must be #RRGGBB")
    String brandColor
) {
}
