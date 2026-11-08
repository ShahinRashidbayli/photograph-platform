package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Body for {@code POST /api/auth/customer/login-code/verify}.
 *
 * <p>Carries the {@code (subdomain, email)} pair as well as the code. That is
 * not redundant: a six-digit secret is small enough to spray, so the lookup must
 * be anchored to one mailbox on one photographer rather than searching every
 * outstanding code in the system. See {@code CustomerAuthService}.
 *
 * <p>The {@code \d{6}} pattern rejects malformed input at the edge, so a
 * garbage value never reaches the attempt counter and burns a legitimate
 * customer's code on their behalf.
 */
public record CustomerLoginCodeVerifyRequest(
    @NotBlank @Email @Size(max = 320) String email,
    // Optional: without it the studio is found from the address (sign-in by
    // email). Null passes @Pattern; a value must still be a well-formed label.
    @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$",
        message = "subdomain must be 3-63 chars, start and end with alphanumeric, hyphens allowed in between")
    String subdomain,
    @NotBlank @Pattern(regexp = "^\\d{6}$", message = "code must be 6 digits")
    String code
) {
}
