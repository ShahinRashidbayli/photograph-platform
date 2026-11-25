package com.photographplatform.api.common.outbox;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A claimed job, as its handler sees it.
 *
 * @param attempts how many times it has been claimed, this time included
 */
public record OutboxJob(
    UUID id,
    String kind,
    UUID tenantId,
    String payloadJson,
    String recipientEmail,
    int priority,
    int attempts,
    OffsetDateTime expiresAt
) {}
