package com.photographplatform.api.common.outbox;

import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.ErasureSubject;
import com.photographplatform.api.common.privacy.PersonalDataEraser;
import java.util.List;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Erasure of the studio's queued and dead emails to or about the subject.
 *
 * <p>A queued job is personal data waiting to be used: an address, and for a
 * lead alert, the lead's name. Deleting it means the email is never sent,
 * which is what erasure asks for. Delivered emails leave no row behind.
 */
@Component
@Order(950)
@Transactional(propagation = Propagation.MANDATORY)
public class OutboxEraser implements PersonalDataEraser {

    private final Outbox outbox;

    public OutboxEraser(Outbox outbox) {
        this.outbox = outbox;
    }

    @Override
    public List<ErasureOutcome> erase(ErasureSubject subject) {
        int deleted = outbox.deleteForPerson(subject.tenantId(), subject.email());
        return List.of(ErasureOutcome.deleted("queuedEmails", deleted));
    }
}
