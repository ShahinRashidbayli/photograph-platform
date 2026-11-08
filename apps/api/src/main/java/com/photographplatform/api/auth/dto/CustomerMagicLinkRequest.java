package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Body for {@code POST /api/auth/customer/login-code/request}.
 *
 * <p>With a subdomain — the client came through the studio's link or address —
 * the code is for that studio, and a first request creates the account. Without
 * one, the client gave only their email, and codes go out for every studio that
 * knows it ({@code CustomerAuthService#requestLoginCodeByEmail}).
 */
public record CustomerMagicLinkRequest(
    @NotBlank @Email @Size(max = 320) String email,
    // Optional: without it the studio is found from the address (sign-in by
    // email). Null passes @Pattern; a value must still be a well-formed label.
    @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$",
        message = "subdomain must be 3-63 chars, start and end with alphanumeric, hyphens allowed in between")
    String subdomain,
    @Size(max = 200) String fullName
) {
}
