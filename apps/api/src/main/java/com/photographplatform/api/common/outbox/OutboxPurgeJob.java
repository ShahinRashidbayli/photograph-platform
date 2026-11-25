package com.photographplatform.api.common.outbox;

import com.photographplatform.api.common.scheduling.JobLock;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Deletes {@code DEAD} outbox jobs 30 days after they died (ADR-005 §3).
 *
 * <p>A dead job still holds a recipient address and the inputs of an email.
 * Thirty days is long enough to notice, investigate and replay; after that
 * the row is personal data kept for no purpose.
 */
@Component
public class OutboxPurgeJob {

    private static final Logger LOG = LoggerFactory.getLogger(OutboxPurgeJob.class);
    private static final String JOB_NAME = "outbox-purge";
    static final Duration KEEP_DEAD_FOR = Duration.ofDays(30);
    private static final Duration LEASE = Duration.ofMinutes(30);

    private final JobLock jobLock;
    private final Outbox outbox;

    public OutboxPurgeJob(JobLock jobLock, Outbox outbox) {
        this.jobLock = jobLock;
        this.outbox = outbox;
    }

    @Scheduled(cron = "${app.outbox.purge-cron:0 30 3 * * *}", zone = "Europe/Berlin")
    public void run() {
        jobLock.runIfLeased(JOB_NAME, LEASE, this::purge);
    }

    void purge() {
        int purged = outbox.purgeDeadOlderThan(KEEP_DEAD_FOR);
        if (purged > 0) {
            LOG.info("Outbox purge removed {} dead jobs older than {} days", purged, KEEP_DEAD_FOR.toDays());
        }
    }
}
