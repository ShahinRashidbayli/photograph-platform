package com.photographplatform.api.portfolio.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InitiateUploadRequest(
    @NotBlank @Size(max = 500) String filename,
    @NotBlank @Size(max = 100) String contentType
) {
}
