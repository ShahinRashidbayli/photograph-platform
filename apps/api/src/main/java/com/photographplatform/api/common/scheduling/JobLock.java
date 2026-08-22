package com.photographplatform.api.common.scheduling;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * An expiring, database-backed lease that lets exactly one instance run a
 * scheduled job.
 *
 * <p>Railway runs more than one replica of the API, and every replica has the
 * same {@code @Scheduled} methods. Without a lease, gallery retention
 * (ADR-001) would run concurrently on all of them — two instances walking the
 * same expired galleries, each deleting the same R2 objects and racing on the
 * same state transitions. ADR-001 §4 calls for a job that is "idempotent and
 * rate-limited"; idempotency makes a double-run survivable, but not running it
 * twice in the first place is what makes it safe.
 *
 * <h2>Why a lease and not a lock</h2>
 * A held lock must be released, and an instance that is SIGKILLed or OOM-killed
 * mid-run never releases anything. A plain mutex would then be held forever and
 * the job would silently stop running — a failure nobody notices until the
 * storage bill arrives. A lease expires on its own, so the worst case is that
 * the job resumes on the next tick after {@code leaseDuration}.
 *
 * <h2>Why one statement</h2>
 * "Is it free?" followed by "take it" is a race with a window between the two.
 * Acquisition is instead a single conditional upsert: {@code ON CONFLICT DO
 * UPDATE ... WHERE locked_until < now()}. Postgres takes a row lock for the
 * conflicting insert, so concurrent attempts serialise on it, and the loser's
 * {@code WHERE} sees the winner's already-written {@code locked_until}. Exactly
 * one caller sees a row count of 1.
 */
@Component
public class JobLock {

    private static final Logger LOG = LoggerFactory.getLogger(JobLock.class);

    /**
     * Identifies this instance in {@code locked_by}. Host name alone is not
     * enough — two containers can share one, and a restarted container reuses
     * it, which would let a new process release the lease its dead predecessor
     * took. The random suffix makes the holder identity per-process.
     */
    private final String owner;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    /**
     * Transactions are driven explicitly rather than by annotation, because
     * {@link #runIfLeased} calls {@link #acquire} on
     * {@code this}. A self-invocation does not pass through Spring's proxy, so
     * the annotation would be silently ignored — and combined with the
     * autocommit note on {@link #acquire}, the lease would never be committed
     * and every instance would win it. An explicit template cannot be bypassed
     * that way.
     */
    private final TransactionTemplate requiresNew;

    public JobLock(JdbcTemplate jdbc, Clock clock, PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.requiresNew = new TransactionTemplate(transactionManager);
        this.requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.owner = resolveHostName() + "/" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static String resolveHostName() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (UnknownHostException e) {
            return "unknown-host";
        }
    }

    public String owner() {
        return owner;
    }

    /**
     * Runs {@code work} if this instance wins the lease, and does nothing if
     * another instance already holds it.
     *
     * <p>{@code leaseDuration} must comfortably exceed the job's worst-case
     * runtime. If the job outlives its lease, a second instance may start the
     * same work on the next tick — which is why every job body must also be
     * idempotent (ADR-001 §4) rather than relying on this lease alone.
     *
     * @return true if the lease was won and {@code work} ran
     */
    public boolean runIfLeased(String jobName, Duration leaseDuration, Runnable work) {
        if (!acquire(jobName, leaseDuration)) {
            LOG.debug("Job '{}' already leased by another instance; skipping this tick", jobName);
            return false;
        }
        try {
            work.run();
            return true;
        } finally {
            // Released even on failure so the next tick can retry immediately
            // rather than waiting out the whole lease. A job that throws is a
            // job that will probably throw again — but making it wait an hour
            // to prove that helps nobody.
            release(jobName);
        }
    }

    /**
     * Runs in its own transaction, and that is not optional.
     *
     * <p>{@code TenantRoutingDataSource} calls {@code setAutoCommit(false)} on
     * every Postgres connection it hands out, so a write issued outside a
     * Spring-managed transaction is never committed — Hikari rolls it back when
     * the connection returns to the pool. The lease would appear to be taken
     * and then vanish, and every instance would win it. REQUIRES_NEW also keeps
     * the lease independent of the job's own transactions: the lock must be
     * durable before the work starts, not committed alongside it.
     */
    public boolean acquire(String jobName, Duration leaseDuration) {
        return Boolean.TRUE.equals(requiresNew.execute(status -> doAcquire(jobName, leaseDuration)));
    }

    private boolean doAcquire(String jobName, Duration leaseDuration) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        int rows = jdbc.update("""
            INSERT INTO scheduled_job_locks (name, locked_until, locked_by, locked_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (name) DO UPDATE
               SET locked_until = EXCLUDED.locked_until,
                   locked_by    = EXCLUDED.locked_by,
                   locked_at    = EXCLUDED.locked_at
             -- <=, not <: the lease is held *until* locked_until, so at that
             -- instant it is free. With a strict <, release() — which sets
             -- locked_until to now — would leave the lease unacquirable until
             -- the clock ticked past it, so a job could not be re-run in the
             -- same instant it finished.
             WHERE scheduled_job_locks.locked_until <= EXCLUDED.locked_at
            """,
            jobName,
            java.sql.Timestamp.from(now.plus(leaseDuration).toInstant()),
            owner,
            java.sql.Timestamp.from(now.toInstant()));
        return rows == 1;
    }

    /**
     * Releases only if this instance still holds the lease.
     *
     * <p>The {@code locked_by} check is what stops a stalled instance, whose
     * lease already expired and was taken over by another, from releasing work
     * that is currently running somewhere else.
     *
     * <p>Expiring the lease rather than deleting the row keeps the last
     * holder and run time visible for debugging "why did this job stop?".
     */
    public void release(String jobName) {
        requiresNew.executeWithoutResult(status -> jdbc.update(
            "UPDATE scheduled_job_locks SET locked_until = ? WHERE name = ? AND locked_by = ?",
            java.sql.Timestamp.from(OffsetDateTime.now(clock).toInstant()), jobName, owner));
    }
}
