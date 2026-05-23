package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Body for {@code POST /api/auth/customer/magic-link/request}.
 * The customer arrives via a photographer's bio link, so we always know
 * which photographer (subdomain) to attach them to.
 */
public record CustomerMagicLinkRequest(
    @NotBlank @Email @Size(max = 320) String email,
    @NotBlank @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$",
        message = "subdomain must be 3-63 chars, start and end with alphanumeric, hyphens allowed in between")
    String subdomain,
    @Size(max = 200) String fullName
) {
}
