package com.photographplatform.api.portfolio.dto;

import java.util.UUID;

/**
 * @param photoId     the row the subsequent complete-call refers to
 * @param r2Key       the object key, for debugging and for the client to store
 * @param uploadUrl   pre-signed PUT; single object, single size, single type
 * @param contentType the type the URL was signed with, which the client MUST
 *                    send as the {@code Content-Type} header on its PUT.
 *                    It is not necessarily the type the client asked for: the
 *                    server canonicalises ({@code image/jpg} → {@code image/jpeg})
 *                    and resolves an undeclared type from the filename. Since
 *                    {@code Content-Type} is one of the signed headers, a PUT
 *                    that sends anything else is rejected with a signature
 *                    error — so echoing this value back is not optional.
 */
public record InitiateUploadResponse(
    UUID photoId,
    String r2Key,
    String uploadUrl,
    String contentType
) {
}
