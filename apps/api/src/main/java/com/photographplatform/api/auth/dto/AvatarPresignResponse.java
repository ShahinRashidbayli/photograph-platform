package com.photographplatform.api.auth.dto;

/**
 * Response from POST /api/auth/me/avatar/presign.
 *
 * <ul>
 *   <li>{@code uploadUrl} — pre-signed PUT URL: browser uploads the file here directly.</li>
 *   <li>{@code viewUrl}   — pre-signed GET URL: use this as the avatar URL after upload.</li>
 *   <li>{@code r2Key}     — the R2 object key (informational, may be useful for debugging).</li>
 *   <li>{@code contentType} — the type the upload URL was signed with, which the
 *       client MUST send as its {@code Content-Type} header. The server
 *       canonicalises what was asked for ({@code image/jpg} → {@code image/jpeg}),
 *       and {@code Content-Type} is a signed header, so a PUT that sends
 *       anything else fails the signature check.</li>
 * </ul>
 */
public record AvatarPresignResponse(
    String uploadUrl, String viewUrl, String r2Key, String contentType) {
}
