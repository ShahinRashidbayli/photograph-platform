package com.photographplatform.api.common.outbox;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

/**
 * A job to write to the outbox, as its owner describes it.
 *
 * @param queue           which worker drains it ({@link OutboxWorker#drain})
 * @param kind            which handler runs it ({@link OutboxHandler#kind()})
 * @param tenantId        bound as {@code TenantContext} while it runs; null for
 *                        work that concerns no studio
 * @param payloadJson     what the handler needs — ids and inputs, never a
 *                        rendered email body (ADR-005 §3)
 * @param recipientEmail  who the job is addressed to, for GDPR erasure; null
 *                        if nobody
 * @param priority        lower runs first
 * @param expiresAt       dropped instead of run past this instant; null for never
 * @param idempotencyKey  a second entry with the same key is ignored while the
 *                        first is still queued; null when the work has no
 *                        natural key
 */
public record OutboxEntry(
    String queue,
    String kind,
    UUID tenantId,
    String payloadJson,
    String recipientEmail,
    int priority,
    OffsetDateTime expiresAt,
    String idempotencyKey
) {

    public OutboxEntry {
        Objects.requireNonNull(queue, "queue");
        Objects.requireNonNull(kind, "kind");
        Objects.requireNonNull(payloadJson, "payloadJson");
    }
}
