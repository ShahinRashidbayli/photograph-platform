package com.photographplatform.api.audit.service;

import com.photographplatform.api.audit.domain.AuditLog;
import com.photographplatform.api.audit.repository.AuditLogRepository;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class AuditService {

    private static final Logger LOG = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Async
    public void log(
        String action,
        String entityType,
        UUID entityId,
        UUID tenantId,
        UUID actorId,
        String ipAddress
    ) {
        AuditLog entry = AuditLog.builder(action)
            .entityType(entityType)
            .entityId(entityId)
            .tenantId(tenantId)
            .actorId(actorId)
            .ipAddress(ipAddress)
            .build();
        auditLogRepository.save(entry);
    }

    /**
     * Logs, and never lets the attempt fail the caller.
     *
     * <p>Three auth services each carried a private {@code tryAudit} wrapping
     * {@link #log} in the same try/catch with the same warning. The rule they
     * were expressing — an audit row must never be the reason a registration,
     * a login or a password reset fails — belongs to auditing, not to each
     * caller remembering it.
     *
     * <p>{@link #log} is {@code @Async}, so the throw this guards against is
     * not the insert itself but scheduling it: a saturated executor, or a
     * shutting-down context. Rare, and never worth failing a sign-in over.
     */
    public void logQuietly(
        String action,
        String entityType,
        UUID entityId,
        UUID tenantId,
        UUID actorId,
        String ipAddress
    ) {
        try {
            log(action, entityType, entityId, tenantId, actorId, ipAddress);
        } catch (RuntimeException ex) {
            LOG.warn("Audit log failed for {} on {}", action, entityId, ex);
        }
    }

    @Async
    public void log(
        String action,
        String entityType,
        UUID entityId,
        UUID tenantId,
        UUID actorId,
        String ipAddress,
        String oldValue,
        String newValue
    ) {
        AuditLog entry = AuditLog.builder(action)
            .entityType(entityType)
            .entityId(entityId)
            .tenantId(tenantId)
            .actorId(actorId)
            .ipAddress(ipAddress)
            .oldValue(oldValue)
            .newValue(newValue)
            .build();
        auditLogRepository.save(entry);
    }
}
