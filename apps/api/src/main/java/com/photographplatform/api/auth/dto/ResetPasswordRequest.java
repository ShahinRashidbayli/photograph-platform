package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Step 2 of a reset: the token from the email plus the new password.
 *
 * <p>Password rules are copied from {@code RegisterRequest} rather than shared,
 * because a reset must never be a way to set a weaker password than
 * registration would have allowed. If the rules ever diverge, that is a bug —
 * {@code PasswordResetServiceTest} pins them together.
 */
public record ResetPasswordRequest(
    @NotBlank String token,

    @NotBlank
    @Size(min = 10, max = 100, message = "password must be at least 10 characters")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).*$",
        message = "password must contain at least one letter and one digit")
    String password
) {
}
