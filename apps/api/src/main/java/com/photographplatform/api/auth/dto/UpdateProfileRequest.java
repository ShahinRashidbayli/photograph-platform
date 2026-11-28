package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Partial update of the signed-in user's profile. All fields are optional —
 * only non-null fields are applied, so the Profile and Studio sections of the
 * settings page can save independently. Subdomain format is normalised and
 * validated in the service (so mixed-case input is accepted).
 *
 * <p>{@code language} is the UI language, {@code de} or {@code en}. The web
 * app sends it whenever it differs from the stored one, so the emails Fotolio
 * sends this user follow the language they use the app in (#126).
 */
public record UpdateProfileRequest(
    @Size(min = 1, max = 200, message = "full name must be 1-200 characters") String fullName,
    @Size(max = 63, message = "subdomain must be at most 63 characters") String subdomain,
    @Size(max = 500, message = "avatar URL must be at most 500 characters") String avatarUrl,
    @Pattern(regexp = "de|en", message = "Language must be de or en") String language
) {
}
