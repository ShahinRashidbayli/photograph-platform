package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.Size;

/**
 * Partial update of the signed-in user's profile. Both fields are optional —
 * only non-null fields are applied, so the Profile and Studio sections of the
 * settings page can save independently. Subdomain format is normalised and
 * validated in the service (so mixed-case input is accepted).
 */
public record UpdateProfileRequest(
    @Size(min = 1, max = 200, message = "full name must be 1-200 characters") String fullName,
    @Size(max = 63, message = "subdomain must be at most 63 characters") String subdomain
) {
}
