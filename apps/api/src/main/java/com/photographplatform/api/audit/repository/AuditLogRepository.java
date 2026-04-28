package com.photographplatform.api.audit.repository;

import com.photographplatform.api.audit.domain.AuditLog;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    List<AuditLog> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    List<AuditLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(
        String entityType, UUID entityId
    );
}
