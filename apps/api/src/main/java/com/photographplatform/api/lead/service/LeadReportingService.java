package com.photographplatform.api.lead.service;

import com.photographplatform.api.audit.domain.AuditLog;
import com.photographplatform.api.audit.dto.AuditLogResponse;
import com.photographplatform.api.audit.repository.AuditLogRepository;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.repository.LeadRepository;
import java.io.IOException;
import java.io.OutputStream;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only views derived from lead data: the CSV export and the per-lead
 * activity timeline.
 *
 * <p>Split out of {@link LeadService} because neither mutates a lead — they
 * exist to render lead data somewhere else (a spreadsheet, an audit panel) and
 * change when those surfaces change, not when the lead lifecycle does. They
 * were also the sole reason {@code LeadService} depended on
 * {@code AuditLogRepository} and {@code LeadCsvExporter}.
 */
@Service
public class LeadReportingService {

    private final LeadRepository leadRepository;
    private final AuditLogRepository auditLogRepository;
    private final LeadCsvExporter leadCsvExporter;

    public LeadReportingService(LeadRepository leadRepository,
                                AuditLogRepository auditLogRepository,
                                LeadCsvExporter leadCsvExporter) {
        this.leadRepository = leadRepository;
        this.auditLogRepository = auditLogRepository;
        this.leadCsvExporter = leadCsvExporter;
    }

    /**
     * Stream every lead in this tenant as CSV. Tenant scoping is enforced by
     * RLS (see {@code V11__tenant_rls.sql}), driven by the tenant bound to
     * this request's {@link com.photographplatform.api.common.config.TenantContext}.
     *
     * <p>Genuinely streaming: the rows arrive as a {@link Stream} backed by a
     * JDBC cursor and are written out as they are read. The previous
     * {@code findAll()} materialised every lead in the tenant into a
     * {@code List} before writing the first byte, so peak heap scaled with the
     * export size — a photographer with a large lead history could OOM the
     * process by clicking Export. {@link LeadCsvExporter} already wrote
     * straight to the socket; this makes the read side match.
     *
     * <p>The stream must be consumed inside this transaction (hence
     * try-with-resources here rather than returning it to the controller) —
     * the cursor dies with the connection.
     */
    @Transactional(readOnly = true)
    public void exportCsv(OutputStream out) throws IOException {
        try (Stream<Lead> leads = leadRepository.streamAllByOrderByCreatedAtDesc()) {
            leadCsvExporter.write(out, leads);
        }
    }

    /**
     * Activity timeline for a single lead — backs the right-panel "Activity"
     * section. Reads from {@code audit_log} filtered to this lead, ordered
     * newest first.
     *
     * <p>Filtered by tenant id as well as entity id: {@code audit_log} has no
     * RLS policy, so entity_id alone is not enough to guarantee isolation.
     * UUIDs are unguessable in practice but defence-in-depth still requires
     * the explicit tenant filter.
     *
     * <p>404s if the lead isn't visible in this tenant — surfacing activity
     * for a lead that doesn't exist in scope would leak the existence of an
     * id outside the photographer's tenant.
     */
    @Transactional(readOnly = true)
    public List<AuditLogResponse> getActivity(UUID leadId) {
        // Existence check: leadRepository is tenant-scoped by RLS, so a
        // missing lead here means "not visible to this tenant" — surface as
        // 404 rather than returning an empty timeline.
        Lead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new NotFoundException("Lead not found: " + leadId));

        return auditLogRepository
            .findByTenantIdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
                SecurityUtils.requireCurrentTenantId(), "LEAD", lead.getId())
            .stream()
            .map(LeadReportingService::toAuditResponse)
            .toList();
    }

    private static AuditLogResponse toAuditResponse(AuditLog row) {
        return new AuditLogResponse(
            row.getId(),
            row.getAction(),
            row.getEntityType(),
            row.getEntityId(),
            row.getOldValue(),
            row.getNewValue(),
            row.getActorId(),
            row.getCreatedAt()
        );
    }
}
