package com.photographplatform.api.common.outbox;

import com.photographplatform.api.common.logging.LogFields;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The {@code outbox_jobs} table (V39, ADR-005): enqueue, claim, settle.
 *
 * <p>Plain SQL rather than JPA, like {@link
 * com.photographplatform.api.common.scheduling.JobLock}: the claim is one
 * {@code UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING},
 * and that statement is the whole concurrency story — two replicas polling at
 * the same instant each skip the rows the other has locked, so no job is
 * claimed twice and nobody waits.
 *
 * <p>Every method needs a transaction, and has one: {@code
 * TenantRoutingDataSource} turns autocommit off, so a write outside a
 * Spring-managed transaction is silently rolled back when the connection goes
 * back to the pool (see {@code JobLock#acquire}). Driven by explicit templates
 * rather than annotations, as in {@code JobLock}, so the guarantee holds
 * however the object is reached.
 */
@Component
public class Outbox {

    private static final Logger LOG = LoggerFactory.getLogger(Outbox.class);

    /** Most rows one claim takes. Small, because each one may block on a provider for seconds. */
    static final int CLAIM_BATCH = 20;

    /**
     * How long a claim holds. Far longer than any handler should take — the
     * email transport times out within seconds — because a lease that runs out
     * mid-send lets a second worker send the same email.
     */
    static final Duration LEASE = Duration.ofMinutes(5);

    private final JdbcTemplate jdbc;
    private final Clock clock;
    /** Joins the caller's transaction: the whole point of an outbox. */
    private final TransactionTemplate joinOrStart;
    /** The worker's own steps, each committed on its own, never inside a caller's work. */
    private final TransactionTemplate own;
    /** Erasure: part of the caller's transaction, or a programming error. */
    private final TransactionTemplate callersOnly;

    public Outbox(JdbcTemplate jdbc, Clock clock, PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.joinOrStart = template(transactionManager, TransactionDefinition.PROPAGATION_REQUIRED);
        this.own = template(transactionManager, TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.callersOnly = template(transactionManager, TransactionDefinition.PROPAGATION_MANDATORY);
    }

    private static TransactionTemplate template(PlatformTransactionManager manager, int propagation) {
        TransactionTemplate template = new TransactionTemplate(manager);
        template.setPropagationBehavior(propagation);
        return template;
    }

    /**
     * Writes the job into the caller's transaction, or a new one if there is
     * none. Joining is the point: if the business write rolls back, so does
     * the job, and nothing is sent for a change that never happened.
     *
     * @return false if a job with the same idempotency key is already queued
     */
    public boolean enqueue(OutboxEntry entry) {
        Timestamp now = Timestamp.from(clock.instant());
        // RETURNING so the new job's id can be logged; a conflict returns no row.
        List<UUID> ids = joinOrStart.execute(status -> jdbc.queryForList("""
            INSERT INTO outbox_jobs (queue, kind, tenant_id, payload, recipient_email, priority,
                                     next_run_at, expires_at, idempotency_key, created_at, updated_at)
            VALUES (?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id
            """,
            UUID.class,
            entry.queue(), entry.kind(), entry.tenantId(), entry.payloadJson(),
            trimToNull(entry.recipientEmail()), entry.priority(),
            now, timestamp(entry.expiresAt()), entry.idempotencyKey(), now, now));
        if (ids == null || ids.isEmpty()) {
            return false;
        }
        // The bridge from a request to the job it started: this line carries the
        // request's id (it runs inside the request), and every line the worker
        // writes for the job later carries the job's. "The customer never got
        // the confirmation" starts at the request and needs to reach the job.
        // Written before the caller commits, so on a rollback it names a job
        // that never existed — harmless, since nothing else will mention it.
        LOG.atInfo()
            .addKeyValue(LogFields.OUTBOX_JOB_ID, ids.get(0))
            .addKeyValue(LogFields.OUTBOX_KIND, entry.kind())
            .log("Outbox job {} queued on {}", ids.get(0), entry.queue());
        return true;
    }

    /**
     * Claims up to {@link #CLAIM_BATCH} due jobs of one queue, best priority
     * first, and commits the claim before anything runs.
     *
     * <p>A {@code RUNNING} row whose lease ran out is due again: that is a
     * worker that died mid-job, and the claim is how its work comes back.
     * The attempt is counted at claim time for the same reason — a job that
     * kills its worker every time must still reach {@code DEAD}. Only a
     * throwing handler reaches the worker's own give-up path, so a row that
     * has used {@code maxAttempts} and lost its lease again is parked here.
     */
    public List<OutboxJob> claim(String queue, int maxAttempts) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        Timestamp at = Timestamp.from(now.toInstant());
        List<OutboxJob> claimed = own.execute(status -> {
            jdbc.update("""
                UPDATE outbox_jobs
                   SET status = 'DEAD', locked_until = NULL, last_error = 'LeaseExpired', updated_at = ?
                 WHERE queue = ? AND status = 'RUNNING' AND locked_until <= ? AND attempts >= ?
                """,
                at, queue, at, maxAttempts);
            return jdbc.query("""
                UPDATE outbox_jobs
                   SET status = 'RUNNING', attempts = attempts + 1, locked_until = ?, updated_at = ?
                 WHERE id IN (
                       SELECT id FROM outbox_jobs
                        WHERE queue = ?
                          AND next_run_at <= ?
                          AND (status = 'PENDING' OR (status = 'RUNNING' AND locked_until <= ?))
                        ORDER BY priority, next_run_at
                        LIMIT ?
                          FOR UPDATE SKIP LOCKED)
                RETURNING id, kind, tenant_id, payload::text AS payload, recipient_email, priority,
                          attempts, expires_at
                """,
                (rs, i) -> toJob(rs),
                Timestamp.from(now.plus(LEASE).toInstant()), at, queue, at, at, CLAIM_BATCH);
        });
        if (claimed == null) {
            return List.of();
        }
        // RETURNING keeps no order; the batch runs in the order it was chosen.
        return claimed.stream().sorted(Comparator.comparingInt(OutboxJob::priority)).toList();
    }

    /**
     * Hands claimed jobs back unrun, as if never claimed: the attempt is not
     * counted, and the next poll on any replica may take them.
     */
    public void release(List<UUID> jobIds) {
        if (jobIds.isEmpty()) {
            return;
        }
        own.executeWithoutResult(status -> jdbc.update("""
            UPDATE outbox_jobs
               SET status = 'PENDING', locked_until = NULL, attempts = attempts - 1, updated_at = ?
             WHERE id = ANY(?) AND status = 'RUNNING'
            """,
            ps -> {
                ps.setTimestamp(1, Timestamp.from(clock.instant()));
                ps.setArray(2, ps.getConnection().createArrayOf("uuid", jobIds.toArray()));
            }));
    }

    /** Done, or dropped: the row goes, and the personal data in it with it (ADR-005 §3). */
    public void delete(UUID jobId) {
        own.executeWithoutResult(status -> jdbc.update("DELETE FROM outbox_jobs WHERE id = ?", jobId));
    }

    public void retryAt(UUID jobId, OffsetDateTime nextRunAt, String error) {
        own.executeWithoutResult(status -> jdbc.update("""
            UPDATE outbox_jobs
               SET status = 'PENDING', next_run_at = ?, locked_until = NULL, last_error = ?, updated_at = ?
             WHERE id = ?
            """,
            Timestamp.from(nextRunAt.toInstant()), truncate(error), Timestamp.from(clock.instant()), jobId));
    }

    public void markDead(UUID jobId, String error) {
        own.executeWithoutResult(status -> jdbc.update("""
            UPDATE outbox_jobs
               SET status = 'DEAD', locked_until = NULL, last_error = ?, updated_at = ?
             WHERE id = ?
            """,
            truncate(error), Timestamp.from(clock.instant()), jobId));
    }

    /** @return how many {@code DEAD} rows older than {@code age} were removed */
    public int purgeDeadOlderThan(Duration age) {
        Integer rows = own.execute(status -> jdbc.update(
            "DELETE FROM outbox_jobs WHERE status = 'DEAD' AND updated_at < ?",
            Timestamp.from(clock.instant().minus(age))));
        return rows == null ? 0 : rows;
    }

    /**
     * Removes the studio's queued and dead jobs that are addressed to, or
     * mention, the address. "Mention" covers the alert to the photographer
     * that carries a new lead's name and address in its payload. The payload
     * match is on the whole JSON string value, quotes included: a bare
     * substring match would also erase, and so never send, the jobs about
     * {@code joann@…} when {@code ann@…} asks.
     *
     * @param normalizedEmail trimmed and lower-cased
     */
    public int deleteForPerson(UUID tenantId, String normalizedEmail) {
        Integer rows = callersOnly.execute(status -> jdbc.update("""
            DELETE FROM outbox_jobs
             WHERE tenant_id = ?
               AND (lower(recipient_email) = ? OR strpos(lower(payload::text), '"' || ? || '"') > 0)
            """,
            tenantId, normalizedEmail, normalizedEmail));
        return rows == null ? 0 : rows;
    }

    /** Rows per status, plus the age of the oldest waiting one. Read by {@link OutboxMetrics}. */
    public Snapshot snapshot() {
        return own.execute(status -> jdbc.queryForObject("""
            SELECT count(*) FILTER (WHERE status = 'PENDING') AS pending,
                   count(*) FILTER (WHERE status = 'RUNNING') AS running,
                   count(*) FILTER (WHERE status = 'DEAD')    AS dead,
                   min(created_at) FILTER (WHERE status <> 'DEAD') AS oldest
              FROM outbox_jobs
            """,
            (rs, i) -> {
                Timestamp oldest = rs.getTimestamp("oldest");
                long ageSeconds = oldest == null
                    ? 0 : Math.max(0, Duration.between(oldest.toInstant(), clock.instant()).toSeconds());
                return new Snapshot(rs.getLong("pending"), rs.getLong("running"), rs.getLong("dead"), ageSeconds);
            }));
    }

    /** @param oldestWaitingSeconds age of the oldest job not yet done; 0 when the queue is empty */
    public record Snapshot(long pending, long running, long dead, long oldestWaitingSeconds) {}

    private static OutboxJob toJob(ResultSet rs) throws SQLException {
        Timestamp expires = rs.getTimestamp("expires_at");
        return new OutboxJob(
            rs.getObject("id", UUID.class),
            rs.getString("kind"),
            rs.getObject("tenant_id", UUID.class),
            rs.getString("payload"),
            rs.getString("recipient_email"),
            rs.getInt("priority"),
            rs.getInt("attempts"),
            expires == null ? null : expires.toInstant().atOffset(ZoneOffset.UTC));
    }

    private static Timestamp timestamp(OffsetDateTime value) {
        return value == null ? null : Timestamp.from(value.toInstant());
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String truncate(String error) {
        if (error == null) {
            return null;
        }
        return error.length() <= 500 ? error : error.substring(0, 500);
    }
}
