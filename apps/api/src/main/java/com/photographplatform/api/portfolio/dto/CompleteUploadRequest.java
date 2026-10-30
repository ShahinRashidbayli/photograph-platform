package com.photographplatform.api.portfolio.dto;

/**
 * Sent after the client's PUT to R2 succeeds.
 *
 * <p>There used to be a {@code fileSizeBytes} here too. It was removed rather
 * than left unread: the size is now fixed at initiate-time, where it is signed
 * into the pre-signed URL as {@code Content-Length} and is therefore a term of
 * the upload rather than a report about it. A field that a client can still
 * send and the server silently ignores is worse than no field — it reads like a
 * way to correct the record, and is not one.
 *
 * <p>Width and height stay optional and remain best-effort hints: the thumbnail
 * job re-extracts them authoritatively when it decodes the image, so a slim
 * client can complete an upload without sending either.
 *
 * @param width  pixel width the client measured, or null
 * @param height pixel height the client measured, or null
 */
public record CompleteUploadRequest(
    Integer width,
    Integer height
) {
}
