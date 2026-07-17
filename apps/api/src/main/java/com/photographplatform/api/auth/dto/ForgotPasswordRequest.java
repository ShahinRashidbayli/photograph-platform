package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Step 1 of a reset: "send a reset link to this address". */
public record ForgotPasswordRequest(
    @NotBlank @Email @Size(max = 320) String email
) {
}
