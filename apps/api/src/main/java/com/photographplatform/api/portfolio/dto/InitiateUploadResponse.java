package com.photographplatform.api.portfolio.dto;

import java.util.UUID;

public record InitiateUploadResponse(
    UUID photoId,
    String r2Key,
    String uploadUrl
) {
}
