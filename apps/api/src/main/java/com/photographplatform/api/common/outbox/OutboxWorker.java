package com.photographplatform.api.common.outbox;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.logging.LogFields;
import com.photographplatform.api.common.logging.MdcScope;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Drains one outbox queue: claim, run, settle.
 *
 * <p>Holds no schedule of its own. The module that owns a queue calls
 * {@link #drain} from its own {@code @Scheduled} method, at the cadence that
 * queue needs — a sign-in code cannot wait a minute, an image derivative can —
 * and on a thread that is not another queue's.
 *
 * <p>Nothing here is held in memory between polls. A deploy or a crash loses
 * at most the jobs that were mid-run, and their leases bring them back.
 */
@Component
public class OutboxWorker {

    private static final Logger LOG = LoggerFactory.getLogger(OutboxWorker.class);

    /**
     * The wait before each retry; one more failure after the last is
     * {@code DEAD}. Spread over about fifteen hours, so a provider outage of
     * an afternoon is ridden out and a revoked API key is noticed (the
     * {@code dead} gauge) and fixed before anything is given up.
     */
    static final List<Duration> BACKOFF = List.of(
        Duration.ofMinutes(1),
        Duration.ofMinutes(5),
        Duration.ofMinutes(30),
        Duration.ofHours(2),
        Duration.ofHours(12));

    /** Every run a job gets: the first, plus one per backoff step. */
    static final int MAX_ATTEMPTS = BACKOFF.size() + 1;

    /**
     * The longest one job may take — connect plus read timeout of the
     * transport, with room to spare. A job is only started while this much of
     * the batch's lease is left; past that a second replica could claim it
     * mid-send and deliver it twice.
     */
    static final Duration ONE_JOB_BUDGET = Duration.ofMinutes(1);

    /** Claims per {@link #drain} call, so one tick cannot run forever behind a flood. */
    private static final int MAX_BATCHES_PER_DRAIN = 10;

    private final Outbox outbox;
    private final Map<String, OutboxHandler> handlers;
    private final Clock clock;
    private final MeterRegistry meters;

    public OutboxWorker(Outbox outbox, List<OutboxHandler> handlers, Clock clock, MeterRegistry meters) {
        this.outbox = outbox;
        this.handlers = handlers.stream()
            .collect(Collectors.toUnmodifiableMap(OutboxHandler::kind, Function.identity()));
        this.clock = clock;
        this.meters = meters;
    }

    /** @return how many jobs were claimed */
    public int drain(String queue) {
        int claimed = 0;
        for (int batch = 0; batch < MAX_BATCHES_PER_DRAIN; batch++) {
            Instant leaseEnds = clock.instant().plus(Outbox.LEASE);
            List<OutboxJob> jobs = outbox.claim(queue, MAX_ATTEMPTS);
            if (jobs.isEmpty()) {
                break;
            }
            claimed += jobs.size();
            for (int i = 0; i < jobs.size(); i++) {
                if (!clock.instant().plus(ONE_JOB_BUDGET).isBefore(leaseEnds)) {
                    // Slow sends ate the lease. What is left goes back rather
                    // than run under a claim another replica may now take.
                    outbox.release(jobs.subList(i, jobs.size()).stream().map(OutboxJob::id).toList());
                    return claimed - (jobs.size() - i);
                }
                runOne(queue, jobs.get(i));
            }
        }
        return claimed;
    }

    /**
     * Everything the job logs — here and inside its handler — carries the job,
     * its kind and its tenant, which is what links a failed send back to the
     * {@code Outbox job queued} line its request wrote.
     */
    private void runOne(String queue, OutboxJob job) {
        try (MdcScope scope = MdcScope.open()
                .with(LogFields.OUTBOX_JOB_ID, job.id())
                .with(LogFields.OUTBOX_KIND, job.kind())
                .with(LogFields.TENANT_ID, job.tenantId())) {
            run(queue, job);
        }
    }

    private void run(String queue, OutboxJob job) {
        if (job.expiresAt() != null && !job.expiresAt().isAfter(OffsetDateTime.now(clock))) {
            // A sign-in code that arrives after it stopped working is worse
            // than none: the user types it, it fails, and they blame the code.
            outbox.delete(job.id());
            count(queue, job.kind(), "expired");
            LOG.info("Outbox job {} kind={} expired before delivery; dropped", job.id(), job.kind());
            return;
        }
        OutboxHandler handler = handlers.get(job.kind());
        if (handler == null) {
            // Retrying cannot help a job nobody can run; parking it keeps the
            // row for whoever deploys the handler back.
            outbox.markDead(job.id(), "No handler for kind " + job.kind());
            count(queue, job.kind(), "dead");
            LOG.error("Outbox job {} has no handler for kind={}; marked DEAD", job.id(), job.kind());
            return;
        }

        String previousTenant = TenantContext.getTenant();
        try {
            bind(job.tenantId() == null ? null : job.tenantId().toString());
            handler.handle(job);
        } catch (Exception failure) {
            settleFailure(queue, job, handler.describeFailure(failure));
            return;
        } finally {
            // Restored, not merely cleared: the scheduler's threads are pooled,
            // and a tenant left bound here would be the next task's tenant.
            bind(previousTenant);
        }
        outbox.delete(job.id());
        count(queue, job.kind(), "succeeded");
    }

    private void settleFailure(String queue, OutboxJob job, String error) {
        if (job.attempts() >= MAX_ATTEMPTS) {
            outbox.markDead(job.id(), error);
            count(queue, job.kind(), "dead");
            LOG.error("Outbox job {} kind={} failed {} times ({}); marked DEAD",
                job.id(), job.kind(), job.attempts(), error);
            return;
        }
        Duration wait = BACKOFF.get(job.attempts() - 1);
        outbox.retryAt(job.id(), OffsetDateTime.now(clock).plus(wait), error);
        count(queue, job.kind(), "retried");
        LOG.warn("Outbox job {} kind={} failed attempt {} ({}); retrying in {}",
            job.id(), job.kind(), job.attempts(), error, wait);
    }

    private void count(String queue, String kind, String outcome) {
        meters.counter("outbox.jobs.processed", "queue", queue, "kind", kind, "outcome", outcome).increment();
    }

    private static void bind(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            TenantContext.clear();
        } else {
            TenantContext.setTenant(tenantId);
        }
    }
}
