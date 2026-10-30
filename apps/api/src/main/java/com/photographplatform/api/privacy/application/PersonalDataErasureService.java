package com.photographplatform.api.privacy.application;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.ErasureSubject;
import com.photographplatform.api.common.privacy.PersonalDataEraser;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.Normalize;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Erases one person's data from the current studio (Art. 17 GDPR).
 *
 * <p>Runs every {@link PersonalDataEraser} — each module's own part — in one
 * transaction: first all identify, then all erase. One transaction because a
 * half-done erasure is worse than none: the photographer would be told it
 * failed while some of it had happened, and a retry would no longer find the
 * person by the links already removed.
 *
 * <h2>Preview</h2>
 * {@link #preview} runs exactly the same code and rolls the transaction back.
 * A separate "what would happen" query per module would be a second definition
 * of erasure that could disagree with the first; this cannot. Changes are
 * flushed before the rollback, so a constraint or trigger that would stop the
 * real run stops the preview too. Storage is only touched after a commit, so
 * a preview never deletes a file.
 */
@Service
public class PersonalDataErasureService {

    private final List<PersonalDataEraser> erasers;
    private final TransactionTemplate transaction;
    private final EntityManager entityManager;
    private final AuditService auditService;

    /** @param erasers every module's part, in {@code @Order} — Spring sorts the list */
    public PersonalDataErasureService(List<PersonalDataEraser> erasers, PlatformTransactionManager txManager,
                                      EntityManager entityManager, AuditService auditService) {
        this.erasers = List.copyOf(erasers);
        this.transaction = new TransactionTemplate(txManager);
        this.entityManager = entityManager;
        this.auditService = auditService;
    }

    /** What {@link #erase} would do for this address, without doing it. */
    public List<ErasureOutcome> preview(String email) {
        return run(email, false, null);
    }

    /** Erases the person behind {@code email} from the current studio. */
    public List<ErasureOutcome> erase(String email, String ipAddress) {
        return run(email, true, ipAddress);
    }

    private List<ErasureOutcome> run(String email, boolean commit, String ipAddress) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();
        ErasureSubject subject = new ErasureSubject(tenantId, Normalize.email(email));
        return transaction.execute(status -> {
            erasers.forEach(eraser -> eraser.identify(subject));
            List<ErasureOutcome> outcomes = erasers.stream()
                .flatMap(eraser -> eraser.erase(subject).stream())
                .toList();
            entityManager.flush();
            if (commit) {
                // The address is deliberately not recorded: an audit entry
                // naming the person would be the one copy erasure left behind.
                auditService.logChange("PERSONAL_DATA_ERASED", "DATA_SUBJECT", null,
                    tenantId, actorId, ipAddress, null, summary(outcomes));
            } else {
                status.setRollbackOnly();
            }
            return outcomes;
        });
    }

    /** {@code "bookings deleted=0 anonymized=2 retained=0; invoices …"} — counts only, nothing about the person. */
    private static String summary(List<ErasureOutcome> outcomes) {
        return outcomes.stream()
            .filter(ErasureOutcome::touchedAnything)
            .map(o -> o.category() + " deleted=" + o.deleted() + " anonymized=" + o.anonymized()
                + " retained=" + o.retained())
            .collect(Collectors.joining("; "));
    }
}
