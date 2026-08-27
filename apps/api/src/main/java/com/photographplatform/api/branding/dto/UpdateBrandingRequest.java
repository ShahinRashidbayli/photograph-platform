package com.photographplatform.api.branding.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * A partial update: <strong>absent means leave it, empty string means clear
 * it.</strong>
 *
 * <p>The first version made absent mean "clear", on the reasoning that the form
 * always sends its whole state. It does not — the colour is saved by one
 * control and the logo by another — so saving a colour silently deleted the
 * logo. That is data loss from a button that says "Save", which is the worst
 * shape a default can take.
 *
 * <p>Empty string rather than a separate delete endpoint: the two fields then
 * behave identically, and a caller that wants to clear both does it in one
 * request instead of two that can half-fail.
 *
 * @param logoKey    R2 object key from the presign endpoint; "" removes the
 *                   logo, absent leaves it
 * @param brandColor `#RRGGBB`; "" resets to the default, absent leaves it.
 *                   Validated here rather than in the database: the value
 *                   reaches it from this one endpoint, and a CHECK constraint
 *                   on a hex string is a migration nobody wants to run twice
 */
public record UpdateBrandingRequest(
    @Size(max = 500) String logoKey,
    // Empty is allowed through the pattern so it can mean "reset to default".
    @Pattern(regexp = "^(#[0-9a-fA-F]{6})?$", message = "brandColor must be #RRGGBB")
    String brandColor
) {
}
