package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Size(min = 1, max = 200) String fullName,
    @NotBlank @Email @Size(max = 320) String email,
    @NotBlank @Size(min = 10, max = 100, message = "password must be at least 10 characters")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).*$",
        message = "password must contain at least one letter and one digit")
    String password,
    @NotBlank @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$",
        message = "subdomain must be 3-63 chars, start and end with alphanumeric, hyphens allowed in between")
    String subdomain,
    @NotNull @Pattern(regexp = "PHOTOGRAPHER|CUSTOMER",
        message = "role must be PHOTOGRAPHER or CUSTOMER")
    String role
) {
}
