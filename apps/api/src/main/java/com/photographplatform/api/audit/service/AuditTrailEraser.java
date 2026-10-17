package com.photographplatform.api.audit.service;

import com.photographplatform.api.audit.repository.AuditLogRepository;
import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.ErasureSubject;
import com.photographplatform.api.common.privacy.PersonalDataEraser;
import java.util.List;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Clears the personal data the audit trail itself wrote down.
 *
 * <p>Audit entries record ids and status names, with one exception: a change
 * of a booking's client address keeps the old and new address in plain text.
 * Those values are cleared; the entry stays, so the trail still shows that the
 * address was changed, by whom and when.
 *
 * <p>{@code audit_log} sits outside RLS, so the tenant is filtered explicitly.
 */
@Component
@Order(900)
@Transactional(propagation = Propagation.MANDATORY)
public class AuditTrailEraser implements PersonalDataEraser {

    static final String CLIENT_EMAIL_CHANGED = "BOOKING_CLIENT_EMAIL_CHANGED";

    private final AuditLogRepository auditLogRepository;

    public AuditTrailEraser(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Override
    public List<ErasureOutcome> erase(ErasureSubject subject) {
        if (subject.bookingIds().isEmpty()) {
            return List.of(ErasureOutcome.anonymized("auditEntries", 0));
        }
        int cleared = auditLogRepository.clearValues(subject.tenantId(), CLIENT_EMAIL_CHANGED, subject.bookingIds());
        return List.of(ErasureOutcome.anonymized("auditEntries", cleared));
    }
}
