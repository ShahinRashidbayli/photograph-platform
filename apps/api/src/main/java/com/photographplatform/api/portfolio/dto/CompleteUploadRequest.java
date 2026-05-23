package com.photographplatform.api.portfolio.dto;

/**
 * Sent after the client's PUT to R2 succeeds. The frontend can read the
 * file's size from the {@code File} object before upload; width/height are
 * optional because the thumbnail job will re-extract them from the bytes
 * anyway. All fields nullable so a slim client can still complete an upload.
 */
public record CompleteUploadRequest(
    Long fileSizeBytes,
    Integer width,
    Integer height
) {
}
