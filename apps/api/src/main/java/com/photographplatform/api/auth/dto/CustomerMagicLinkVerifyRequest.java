package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CustomerMagicLinkVerifyRequest(
    @NotBlank @Size(max = 100) String token
) {
}
