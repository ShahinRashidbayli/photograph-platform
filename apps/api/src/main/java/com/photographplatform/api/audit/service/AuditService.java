package com.photographplatform.api.audit.service;

import com.photographplatform.api.audit.domain.AuditLog;
import com.photographplatform.api.audit.repository.AuditLogRepository;
import java.util.UUID;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class AuditService {

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
