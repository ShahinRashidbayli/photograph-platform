package com.photographplatform.api.portfolio.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Asks for a pre-signed PUT so the browser can upload one photo straight to R2.
 *
 * @param filename      the original filename, kept for display and for naming
 *                      entries in a gallery ZIP. It does <em>not</em> decide the
 *                      object key's extension — see {@code ImageUploadType}.
 * @param contentType   what the client is about to upload. Resolved against a
 *                      whitelist rather than trusted: this value is pinned into
 *                      the pre-signed URL and is what object storage will later
 *                      serve the bytes as, so accepting {@code text/html} here
 *                      would mean storing an executable page.
 * @param fileSizeBytes the exact size of the file. Required, because it is
 *                      signed into the URL as {@code Content-Length} — that is
 *                      what makes the upload bounded (see
 *                      {@code R2StorageService#generateUploadUrl}). The client
 *                      already knows it: it comes from the {@code File} object
 *                      it is about to send.
 */
public record InitiateUploadRequest(
    @NotBlank @Size(max = 500) String filename,
    @NotBlank @Size(max = 100) String contentType,
    @NotNull @Positive Long fileSizeBytes
) {
}
