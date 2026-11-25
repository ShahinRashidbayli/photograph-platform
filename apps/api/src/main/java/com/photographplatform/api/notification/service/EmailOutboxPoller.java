package com.photographplatform.api.notification.service;

import com.photographplatform.api.common.outbox.OutboxWorker;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Drains the email queue every second, on every replica.
 *
 * <p>A second because a person is waiting for their sign-in code with the tab
 * open. No lease: the claim's {@code FOR UPDATE SKIP LOCKED} already keeps two
 * replicas off the same row, and a lease would leave all but one replica idle.
 * The poll is one indexed query against a table that is empty when all is well.
 *
 * <p>{@code app.outbox.enabled=false} turns it off, for a context with no
 * schema behind it; queued email then waits in the table.
 */
@Component
@ConditionalOnProperty(name = "app.outbox.enabled", havingValue = "true", matchIfMissing = true)
public class EmailOutboxPoller {

    private final OutboxWorker worker;

    public EmailOutboxPoller(OutboxWorker worker) {
        this.worker = worker;
    }

    @Scheduled(fixedDelayString = "${app.outbox.email-poll-ms:1000}")
    public void poll() {
        worker.drain(EmailService.QUEUE);
    }
}
