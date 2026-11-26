package com.photographplatform.api.notification.dto;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

/**
 * An email to queue: which template, to whom, with what inputs.
 *
 * @param template        an {@code EmailRenderer#template()}
 * @param to              recipient; never logged
 * @param tenantId        whose studio this concerns, or null where there is none
 *                        (the "no studio knows this address" reply)
 * @param params          the renderer's inputs; stored as JSON until sent
 * @param idempotencyKey  {@code TYPE:aggregate-id}, so a second queueing of the
 *                        same email is ignored while the first waits; null when
 *                        every request is new work (each sign-in code)
 * @param expiresAt       dropped instead of sent past this instant: the moment
 *                        the code or link inside stops working; null for never
 * @param fromName        the sender's display name for this message, or null
 *                        for the global {@code app.email.from-name}; the
 *                        address itself always stays {@code app.email.from}
 * @param replyTo         where the recipient's reply goes, or null for none;
 *                        never logged
 */
public record OutgoingEmail(
    String template,
    String to,
    UUID tenantId,
    Object params,
    String idempotencyKey,
    OffsetDateTime expiresAt,
    String fromName,
    String replyTo
) {

    public OutgoingEmail {
        Objects.requireNonNull(template, "template");
        Objects.requireNonNull(to, "to");
        Objects.requireNonNull(params, "params");
        // A studio with an empty reply address set must not get "" queued: every
        // provider rejects it, and the outbox would retry it until DEAD.
        replyTo = replyTo == null || replyTo.isBlank() ? null : replyTo.strip();
    }

    /** Sent as Fotolio: the global sender name, and no Reply-To. */
    public OutgoingEmail(String template, String to, UUID tenantId, Object params,
                         String idempotencyKey, OffsetDateTime expiresAt) {
        this(template, to, tenantId, params, idempotencyKey, expiresAt, null, null);
    }
}
