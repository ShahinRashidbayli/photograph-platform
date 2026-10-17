package com.photographplatform.api.audit.repository;

import com.photographplatform.api.audit.domain.AuditLog;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    /**
     * Tenant-scoped variant for surfacing an entity's activity to its owner.
     * {@code audit_log} has no RLS policy (unlike the tables in
     * {@code V11__tenant_rls.sql}), so entity_id alone is not enough to
     * guarantee isolation — entity ids are UUIDs and effectively unguessable,
     * but defence-in-depth still requires the explicit tenant filter here.
     */
    List<AuditLog> findByTenantIdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
        UUID tenantId, String entityType, UUID entityId
    );

    /**
     * Clears the recorded values of one action on these entities, keeping the
     * entry itself — who did what, and when, survives an erasure; the address
     * that was written down does not.
     */
    @Modifying
    @Query("""
        UPDATE AuditLog a SET a.oldValue = NULL, a.newValue = NULL
        WHERE a.tenantId = :tenantId AND a.action = :action AND a.entityId IN :entityIds
          AND (a.oldValue IS NOT NULL OR a.newValue IS NOT NULL)
        """)
    int clearValues(
        @Param("tenantId") UUID tenantId, @Param("action") String action,
        @Param("entityIds") Collection<UUID> entityIds);
}
