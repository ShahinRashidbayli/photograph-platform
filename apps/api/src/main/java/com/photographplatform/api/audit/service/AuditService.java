package com.photographplatform.api.audit.service;

import com.photographplatform.api.audit.domain.AuditEntry;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

/**
 * Records that something happened.
 *
 * <p>Publishes rather than writes: {@link AuditLogWriter} turns the entry into
 * a row after the caller's transaction commits, so the trail cannot claim an
 * operation that was rolled back. Publishing is an in-memory hand-off — no
 * database round-trip, no thread hand-off, nothing that can fail — which is
 * what lets every call site keep treating auditing as free.
 */
@Service
public class AuditService {

    private final ApplicationEventPublisher events;

    public AuditService(ApplicationEventPublisher events) {
        this.events = events;
    }

    public void log(
        String action,
        String entityType,
        UUID entityId,
        UUID tenantId,
        UUID actorId,
        String ipAddress
    ) {
        events.publishEvent(new AuditEntry(action, entityType, entityId, tenantId, actorId, ipAddress));
    }

    /**
     * Records a change, keeping what the value was and what it became.
     *
     * <p>Named apart from {@link #log} rather than overloading it: at a call
     * site the two extra arguments were a pair of bare strings whose meaning —
     * old first, new second — was visible only by counting commas against the
     * declaration. One test had to keep a dead method around purely to tell
     * Mockito which overload it meant.
     */
    public void logChange(
        String action,
        String entityType,
        UUID entityId,
        UUID tenantId,
        UUID actorId,
        String ipAddress,
        String oldValue,
        String newValue
    ) {
        events.publishEvent(new AuditEntry(
            action, entityType, entityId, tenantId, actorId, ipAddress, oldValue, newValue));
    }

    /**
     * Says at the call site that an audit row must never be the reason this
     * operation fails — a registration, a login, a password reset.
     *
     * <p>Three auth services each carried a private {@code tryAudit} wrapping
     * the write in the same try/catch; the rule they were expressing belongs to
     * auditing, not to each caller remembering it.
     *
     * <p>Structurally this is now the same as {@link #log}: publishing cannot
     * throw, and the write happens after commit on another thread where a
     * failure is caught and logged. Kept because it still says something the
     * type system does not — that this particular call is on a path where
     * losing the row is preferable to failing the request — and because the day
     * auditing grows a synchronous mode, these are the call sites that must not
     * get it.
     */
    public void logQuietly(
        String action,
        String entityType,
        UUID entityId,
        UUID tenantId,
        UUID actorId,
        String ipAddress
    ) {
        log(action, entityType, entityId, tenantId, actorId, ipAddress);
    }
}
