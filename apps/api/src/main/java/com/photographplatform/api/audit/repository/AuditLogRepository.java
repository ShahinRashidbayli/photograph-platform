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

    /**
     * Tenant-scoped variant for surfacing an entity's activity to its owner.
     * Audit_log is in the public schema (not the tenant search_path), so
     * entity_id alone is not enough to guarantee isolation — entity ids are
     * UUIDs and effectively unguessable, but defence-in-depth still requires
     * the tenant filter.
     */
    List<AuditLog> findByTenantIdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
        UUID tenantId, String entityType, UUID entityId
    );
}
