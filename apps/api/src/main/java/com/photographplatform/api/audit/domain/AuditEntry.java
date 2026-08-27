package com.photographplatform.api.audit.domain;

import java.util.UUID;

/**
 * One audit row, as an event, before anything has written it.
 *
 * <p>Exists so the decision to record something and the act of recording it can
 * happen at different moments: a service publishes this inside its transaction,
 * and {@code AuditLogWriter} turns it into a row only once that transaction has
 * committed. See that class for why.
 *
 * <p>A record rather than the entity, because it travels between threads.
 * {@link AuditLog} is a JPA entity and belongs to the persistence context that
 * writes it; handing one across an {@code @Async} boundary hands over something
 * whose identity and lifecycle are owned elsewhere.
 *
 * @param oldValue what the field was, for the change form; null otherwise
 * @param newValue what it became, for the change form; null otherwise
 */
public record AuditEntry(
    String action,
    String entityType,
    UUID entityId,
    UUID tenantId,
    UUID actorId,
    String ipAddress,
    String oldValue,
    String newValue
) {

    public AuditEntry(
        String action, String entityType, UUID entityId,
        UUID tenantId, UUID actorId, String ipAddress) {
        this(action, entityType, entityId, tenantId, actorId, ipAddress, null, null);
    }

    public AuditLog toRow() {
        return AuditLog.builder(action)
            .entityType(entityType)
            .entityId(entityId)
            .tenantId(tenantId)
            .actorId(actorId)
            .ipAddress(ipAddress)
            .oldValue(oldValue)
            .newValue(newValue)
            .build();
    }
}
