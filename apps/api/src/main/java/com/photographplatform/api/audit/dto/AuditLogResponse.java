package com.photographplatform.api.audit.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Public projection of an audit-log entry for the lead activity timeline.
 * Intentionally drops {@code tenantId} (already implicit from the request)
 * and {@code ipAddress} (sensitive operational detail not useful to the
 * photographer in this view).
 */
public record AuditLogResponse(
    UUID id,
    String action,
    String entityType,
    UUID entityId,
    String oldValue,
    String newValue,
    UUID actorId,
    OffsetDateTime createdAt
) {}
