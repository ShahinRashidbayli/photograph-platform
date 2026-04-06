package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Size(max = 200) String fullName,
    @NotBlank @Email @Size(max = 320) String email,
    @NotBlank @Size(min = 8, max = 100) String password,
    @NotBlank @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$",
        message = "subdomain must be 3-63 chars, start and end with alphanumeric, hyphens allowed in between")
    String subdomain
) {
}
