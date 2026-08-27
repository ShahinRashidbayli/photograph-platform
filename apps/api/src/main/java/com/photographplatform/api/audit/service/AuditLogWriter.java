package com.photographplatform.api.audit.service;

import com.photographplatform.api.audit.domain.AuditEntry;
import com.photographplatform.api.audit.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Turns an {@link AuditEntry} into a row, once the thing it describes has
 * actually happened.
 *
 * <h2>Why after commit</h2>
 * {@code AuditService} used to write the row from an {@code @Async} method,
 * which runs on another thread in its own transaction. That transaction
 * committed independently of the caller's — so a booking creation that rolled
 * back afterwards left a BOOKING_CREATED row behind, naming an entity id that
 * no longer existed. An audit trail that records things which did not happen is
 * worse than one with gaps: a gap is visibly a gap, while a false row is
 * indistinguishable from a true one and is exactly what someone reading the
 * trail is relying on.
 *
 * <p>{@code AFTER_COMMIT} inverts that. The entry is published inside the
 * caller's transaction, held, and written only if that transaction commits. The
 * cost is the opposite failure: a crash between commit and this write loses the
 * row. That is the better side to fail on, and the window is small —
 * {@code AsyncConfig} waits for queued tasks on shutdown, so an ordinary deploy
 * drains rather than drops.
 *
 * <h2>Why still async</h2>
 * The write is a database round-trip on the request's own thread otherwise,
 * added to every audited operation after its work is already done. {@code
 * @Async} moves it off, and the executor's {@code CallerRunsPolicy} means
 * saturation degrades to inline rather than to a rejection — which, after
 * commit, nothing could act on anyway.
 *
 * <h2>Why fallbackExecution</h2>
 * Not every caller is transactional, and it is deliberate: {@code
 * AuthService#login} says so in as many words. Without the fallback a
 * transactional event listener silently drops events published outside a
 * transaction, so every login, magic-link request and lockout would stop being
 * audited — the failure being invisible, which is the worst property an audit
 * change can have.
 */
@Component
public class AuditLogWriter {

    private static final Logger LOG = LoggerFactory.getLogger(AuditLogWriter.class);

    private final AuditLogRepository auditLogRepository;

    public AuditLogWriter(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Never throws. The caller's transaction is already committed, so there is
     * nobody left to tell and nothing left to undo — an exception escaping here
     * would only surface as a stack trace on a worker thread against a request
     * that succeeded.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void write(AuditEntry entry) {
        try {
            auditLogRepository.save(entry.toRow());
        } catch (RuntimeException ex) {
            LOG.error("Audit write failed for {} on {}", entry.action(), entry.entityId(), ex);
        }
    }
}
