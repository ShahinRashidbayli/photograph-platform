package com.photographplatform.api.common.scheduling;

import com.photographplatform.api.IntegrationTestBase;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The lease that keeps gallery retention from running twice at once.
 *
 * <p>Exercised against real Postgres rather than a mock, because every
 * property that matters here is a property of the database: the atomicity of
 * {@code ON CONFLICT DO UPDATE ... WHERE}, the row lock two instances
 * serialise on, and the fact that a write through
 * {@code TenantRoutingDataSource} is only durable inside a transaction. None
 * of that survives being stubbed out.
 */
class JobLockIT extends IntegrationTestBase {

    // Lock rows are cleared by IntegrationTestBase#resetDatabase, which runs on
    // its own superuser connection with autocommit on. Deleting them through
    // `jdbc` here would not work: that connection comes from
    // TenantRoutingDataSource with autocommit off, so a DELETE outside a
    // transaction is rolled back on release — the very trap JobLock documents.

    private static final String JOB = "test-job";
    private static final Instant T0 = Instant.parse("2026-08-22T03:00:00Z");

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private JobLock lockAt(Instant now) {
        return new JobLock(jdbc, Clock.fixed(now, ZoneOffset.UTC), transactionManager);
    }

    // ── the basic contract ──────────────────────────────────────────────

    @Test
    void theFirstInstanceWinsTheLease() {
        assertThat(lockAt(T0).acquire(JOB, Duration.ofMinutes(30))).isTrue();
    }

    /**
     * The whole point. Two replicas, same tick, one lease.
     */
    @Test
    void aSecondInstanceIsLockedOutWhileTheLeaseIsHeld() {
        JobLock first = lockAt(T0);
        JobLock second = lockAt(T0);

        assertThat(first.acquire(JOB, Duration.ofMinutes(30))).isTrue();
        assertThat(second.acquire(JOB, Duration.ofMinutes(30))).isFalse();
    }

    /**
     * The lease has to be committed, not just written. TenantRoutingDataSource
     * turns autocommit off on every connection, so a lease taken outside a
     * transaction would be rolled back when the connection returned to the
     * pool — and every instance would then "win". Reading it back through a
     * separate call is what proves it survived.
     */
    @Test
    void theLeaseIsDurableAndNotRolledBack() {
        lockAt(T0).acquire(JOB, Duration.ofMinutes(30));

        Integer rows = jdbc.queryForObject(
            "SELECT count(*) FROM scheduled_job_locks WHERE name = ?", Integer.class, JOB);
        assertThat(rows).isEqualTo(1);
    }

    /**
     * An instance that is SIGKILLed mid-run never releases. If the lease did
     * not expire on its own the job would stop running forever, and nobody
     * would notice until the storage bill arrived.
     */
    @Test
    void anExpiredLeaseCanBeTakenOverByAnotherInstance() {
        JobLock dead = lockAt(T0);
        assertThat(dead.acquire(JOB, Duration.ofMinutes(30))).isTrue();

        JobLock later = lockAt(T0.plus(Duration.ofMinutes(31)));
        assertThat(later.acquire(JOB, Duration.ofMinutes(30))).isTrue();
    }

    @Test
    void aLeaseIsStillHeldOneSecondBeforeItExpires() {
        lockAt(T0).acquire(JOB, Duration.ofMinutes(30));

        JobLock justBefore = lockAt(T0.plus(Duration.ofMinutes(30)).minusSeconds(1));
        assertThat(justBefore.acquire(JOB, Duration.ofMinutes(30))).isFalse();
    }

    @Test
    void releasingLetsTheNextInstanceStraightIn() {
        JobLock first = lockAt(T0);
        first.acquire(JOB, Duration.ofMinutes(30));
        first.release(JOB);

        assertThat(lockAt(T0).acquire(JOB, Duration.ofMinutes(30))).isTrue();
    }

    /**
     * A stalled instance whose lease already expired — and was taken over —
     * must not be able to release the work now running somewhere else.
     */
    @Test
    void anInstanceCannotReleaseALeaseItNoLongerHolds() {
        JobLock stalled = lockAt(T0);
        stalled.acquire(JOB, Duration.ofMinutes(30));

        JobLock tookOver = lockAt(T0.plus(Duration.ofMinutes(31)));
        assertThat(tookOver.acquire(JOB, Duration.ofMinutes(30))).isTrue();

        // The stalled instance finally finishes and releases.
        stalled.release(JOB);

        // The takeover's lease must still stand.
        assertThat(lockAt(T0.plus(Duration.ofMinutes(32))).acquire(JOB, Duration.ofMinutes(30)))
            .isFalse();
    }

    // ── runIfLeased ─────────────────────────────────────────────────────

    @Test
    void runIfLeasedRunsTheWorkAndThenFreesTheLease() {
        AtomicInteger runs = new AtomicInteger();
        JobLock lock = lockAt(T0);

        assertThat(lock.runIfLeased(JOB, Duration.ofMinutes(30), runs::incrementAndGet)).isTrue();
        assertThat(runs.get()).isEqualTo(1);
        // Released, so the next tick can start immediately.
        assertThat(lockAt(T0).acquire(JOB, Duration.ofMinutes(30))).isTrue();
    }

    @Test
    void runIfLeasedSkipsTheWorkWhenAnotherInstanceHoldsTheLease() {
        lockAt(T0).acquire(JOB, Duration.ofMinutes(30));

        AtomicInteger runs = new AtomicInteger();
        assertThat(lockAt(T0).runIfLeased(JOB, Duration.ofMinutes(30), runs::incrementAndGet))
            .isFalse();
        assertThat(runs.get()).isZero();
    }

    /**
     * A job that throws must still free its lease, or one bad run blocks the
     * next attempt for the whole lease duration.
     */
    @Test
    void aFailingJobStillReleasesItsLease() {
        JobLock lock = lockAt(T0);

        try {
            lock.runIfLeased(JOB, Duration.ofMinutes(30), () -> {
                throw new IllegalStateException("boom");
            });
        } catch (IllegalStateException expected) {
            // propagated on purpose — the caller decides how to report it
        }

        assertThat(lockAt(T0).acquire(JOB, Duration.ofMinutes(30))).isTrue();
    }

    // ── the race the lease exists for ───────────────────────────────────

    /**
     * Eight threads, one lease. "Check then take" would let several through
     * here; a single conditional upsert cannot, because Postgres serialises the
     * conflicting inserts on the row lock and the losers' WHERE then sees the
     * winner's locked_until.
     */
    @Test
    void exactlyOneOfManyConcurrentInstancesWinsTheLease() throws Exception {
        int instances = 8;
        ExecutorService pool = Executors.newFixedThreadPool(instances);
        try {
            List<Callable<Boolean>> attempts = java.util.stream.IntStream.range(0, instances)
                .<Callable<Boolean>>mapToObj(i ->
                    () -> lockAt(T0).acquire(JOB, Duration.ofMinutes(30)))
                .toList();

            long winners = pool.invokeAll(attempts).stream()
                .map(JobLockIT::get)
                .filter(Boolean::booleanValue)
                .count();

            assertThat(winners).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    private static Boolean get(Future<Boolean> future) {
        try {
            return future.get();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
