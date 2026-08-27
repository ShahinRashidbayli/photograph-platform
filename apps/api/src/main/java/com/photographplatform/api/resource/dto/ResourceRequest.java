package com.photographplatform.api.resource.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * @param kind ROOM or EQUIPMENT. Validated as a pattern rather than an enum so
 *             a studio needing a third kind is a config change, not a release —
 *             the value is presentational.
 */
public record ResourceRequest(
    @NotBlank @Size(max = 120) String name,
    @Pattern(regexp = "ROOM|EQUIPMENT", message = "kind must be ROOM or EQUIPMENT") String kind,
    @Size(max = 2000) String notes,
    Boolean active
) {
}
