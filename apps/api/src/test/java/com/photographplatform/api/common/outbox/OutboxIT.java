package com.photographplatform.api.common.outbox;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.privacy.ErasureSubject;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The outbox against real Postgres: everything the ticket's acceptance
 * criteria ask of it that is a property of the database — the claim's
 * {@code SKIP LOCKED}, the job joining the caller's transaction, RLS around a
 * job, and a lease that brings a dead worker's job back.
 *
 * <p>Uses its own queue, {@code "test"}, so the email poller running in this
 * context never touches these rows, and drives a worker built here so the
 * handlers are the test's.
 */
class OutboxIT extends IntegrationTestBase {

    private static final String QUEUE = "test";

    @Autowired private Outbox outbox;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager txManager;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private OutboxEraser eraser;

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    private static OutboxEntry entry(UUID tenantId, String recipient, String key) {
        return new OutboxEntry(QUEUE, "probe", tenantId, "{\"n\":1}", recipient, 5, null, key);
    }

    private OutboxWorker workerWith(OutboxHandler handler) {
        return new OutboxWorker(outbox, List.of(handler), Clock.systemUTC(), new SimpleMeterRegistry());
    }

    private long count(String where) {
        return countAcrossTenants("SELECT count(*) FROM outbox_jobs WHERE " + where);
    }

    private void asSuperuser(String sql) {
        executeAcrossTenants(sql);
    }

    // ── the transaction is the job's ────────────────────────────────────

    @Test
    void aRolledBackWriteLeavesNoJob() {
        new TransactionTemplate(txManager).executeWithoutResult(status -> {
            outbox.enqueue(entry(null, "a@example.test", null));
            status.setRollbackOnly();
        });

        assertThat(count("true")).isZero();
    }

    @Test
    void aCommittedJobOutlivesTheWorkerThatWasRunning() {
        // A crash or deploy is a worker that is gone. What is left is the row,
        // and any worker started afterwards runs it.
        outbox.enqueue(entry(null, "a@example.test", null));
        AtomicInteger ran = new AtomicInteger();

        int claimed = workerWith(handler(job -> ran.incrementAndGet())).drain(QUEUE);

        assertThat(claimed).isEqualTo(1);
        assertThat(ran).hasValue(1);
        assertThat(count("true")).as("a done job leaves nothing behind").isZero();
    }

    @Test
    void aJobWhoseWorkerDiedMidRunIsClaimedAgainOnceTheLeaseRunsOut() {
        outbox.enqueue(entry(null, "a@example.test", null));
        asSuperuser("UPDATE outbox_jobs SET status = 'RUNNING', attempts = 1, "
            + "locked_until = now() - interval '1 second'");
        AtomicInteger ran = new AtomicInteger();

        workerWith(handler(job -> {
            assertThat(job.attempts()).isEqualTo(2);
            ran.incrementAndGet();
        })).drain(QUEUE);

        assertThat(ran).hasValue(1);
    }

    @Test
    void aJobStillLeasedIsLeftAlone() {
        outbox.enqueue(entry(null, "a@example.test", null));
        asSuperuser("UPDATE outbox_jobs SET status = 'RUNNING', locked_until = now() + interval '5 minutes'");

        assertThat(workerWith(handler(job -> { })).drain(QUEUE)).isZero();
    }

    // ── idempotency and retry ───────────────────────────────────────────

    @Test
    void theSameIdempotencyKeyIsQueuedOnce() {
        assertThat(outbox.enqueue(entry(null, "a@example.test", "LEAD_NOTIFICATION:1"))).isTrue();
        assertThat(outbox.enqueue(entry(null, "a@example.test", "LEAD_NOTIFICATION:1"))).isFalse();
        assertThat(outbox.enqueue(entry(null, "a@example.test", null))).isTrue();
        assertThat(outbox.enqueue(entry(null, "a@example.test", null))).isTrue();

        assertThat(count("true")).isEqualTo(3);
    }

    @Test
    void aFailedJobWaitsForItsRetryAndIsNotRunTwiceMeanwhile() {
        outbox.enqueue(entry(null, "a@example.test", null));
        AtomicInteger attempts = new AtomicInteger();
        OutboxWorker worker = workerWith(handler(job -> {
            attempts.incrementAndGet();
            throw new IllegalStateException("503");
        }));

        worker.drain(QUEUE);
        worker.drain(QUEUE);

        assertThat(attempts).as("the retry is a minute out, not the next poll").hasValue(1);
        assertThat(count("status = 'PENDING' AND attempts = 1 AND next_run_at > now() "
            + "AND last_error = 'IllegalStateException'")).isEqualTo(1);
    }

    @Test
    void aJobThatRecoversIsDeliveredOnItsRetry() {
        outbox.enqueue(entry(null, "a@example.test", null));
        AtomicInteger calls = new AtomicInteger();
        OutboxWorker worker = workerWith(handler(job -> {
            if (calls.incrementAndGet() == 1) {
                throw new IllegalStateException("503");
            }
        }));

        worker.drain(QUEUE);
        asSuperuser("UPDATE outbox_jobs SET next_run_at = now() - interval '1 second'");
        worker.drain(QUEUE);

        assertThat(calls).hasValue(2);
        assertThat(count("true")).isZero();
    }

    @Test
    void aJobThatNeverRecoversEndsDeadAndVisible() {
        outbox.enqueue(entry(null, "a@example.test", null));
        OutboxWorker worker = workerWith(handler(job -> {
            throw new IllegalStateException("503");
        }));

        for (int i = 0; i <= OutboxWorker.BACKOFF.size(); i++) {
            worker.drain(QUEUE);
            asSuperuser("UPDATE outbox_jobs SET next_run_at = now() - interval '1 second'");
        }

        assertThat(count("status = 'DEAD' AND attempts = " + (OutboxWorker.BACKOFF.size() + 1)))
            .isEqualTo(1);
        assertThat(outbox.snapshot().dead()).isEqualTo(1);
        assertThat(worker.drain(QUEUE)).as("a dead job is never claimed").isZero();
    }

    @Test
    void aJobThatKillsItsWorkerEveryTimeStillEndsDead() {
        // No handler ever throws here: the worker dies mid-run, so only the
        // claim sees the attempts run out.
        outbox.enqueue(entry(null, "a@example.test", null));
        asSuperuser("UPDATE outbox_jobs SET status = 'RUNNING', attempts = " + OutboxWorker.MAX_ATTEMPTS
            + ", locked_until = now() - interval '1 second'");

        assertThat(workerWith(handler(job -> { })).drain(QUEUE)).isZero();

        assertThat(count("status = 'DEAD' AND last_error = 'LeaseExpired'")).isEqualTo(1);
    }

    @Test
    void aReleasedJobIsClaimableAgainWithoutCountingTheAttempt() {
        outbox.enqueue(entry(null, "a@example.test", null));
        List<OutboxJob> jobs = outbox.claim(QUEUE, OutboxWorker.MAX_ATTEMPTS);

        outbox.release(jobs.stream().map(OutboxJob::id).toList());

        assertThat(count("status = 'PENDING' AND attempts = 0 AND locked_until IS NULL")).isEqualTo(1);
    }

    // ── several replicas ────────────────────────────────────────────────

    @Test
    void twoWorkersPollingTogetherRunEveryJobExactlyOnce() throws Exception {
        int jobs = 120;
        for (int i = 0; i < jobs; i++) {
            outbox.enqueue(entry(null, "a" + i + "@example.test", null));
        }
        Map<UUID, Integer> runs = new ConcurrentHashMap<>();
        OutboxHandler counting = handler(job -> runs.merge(job.id(), 1, Integer::sum));
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Callable<Integer>> replicas = new ArrayList<>();
            for (int r = 0; r < 2; r++) {
                OutboxWorker replica = workerWith(counting);
                replicas.add(() -> {
                    start.await();
                    int total = 0;
                    int claimed;
                    do {
                        claimed = replica.drain(QUEUE);
                        total += claimed;
                    } while (claimed > 0);
                    return total;
                });
            }
            List<Future<Integer>> results = new ArrayList<>();
            for (Callable<Integer> replica : replicas) {
                results.add(pool.submit(replica));
            }
            start.countDown();
            int claimed = 0;
            for (Future<Integer> result : results) {
                claimed += result.get();
            }

            assertThat(claimed).isEqualTo(jobs);
            assertThat(runs).hasSize(jobs);
            assertThat(runs.values()).allMatch(n -> n == 1);
        } finally {
            pool.shutdownNow();
        }
    }

    // ── tenants ─────────────────────────────────────────────────────────

    @Test
    void eachJobRunsAsItsOwnTenantSoRlsStillApplies() {
        UUID tenantA = tenantRepository.save(new Tenant("outbox-a", "a@outbox-test.example")).getId();
        UUID tenantB = tenantRepository.save(new Tenant("outbox-b", "b@outbox-test.example")).getId();
        insertClient(tenantA, "only-a@example.test");
        insertClient(tenantB, "only-b@example.test");
        insertClient(tenantB, "also-b@example.test");
        outbox.enqueue(entry(tenantA, "x@example.test", null));
        outbox.enqueue(entry(tenantB, "y@example.test", null));

        Map<UUID, List<String>> seen = new ConcurrentHashMap<>();
        workerWith(handler(job -> seen.put(job.tenantId(),
            new TransactionTemplate(txManager).execute(status ->
                jdbc.queryForList("SELECT email FROM clients ORDER BY email", String.class)))))
            .drain(QUEUE);

        assertThat(seen.get(tenantA)).containsExactly("only-a@example.test");
        assertThat(seen.get(tenantB)).containsExactly("also-b@example.test", "only-b@example.test");
    }

    // ── retention and erasure ───────────────────────────────────────────

    @Test
    void deadJobsArePurgedAfterThirtyDaysAndNotBefore() {
        outbox.enqueue(entry(null, "old@example.test", null));
        outbox.enqueue(entry(null, "recent@example.test", null));
        asSuperuser("UPDATE outbox_jobs SET status = 'DEAD', updated_at = now() - interval '31 days' "
            + "WHERE recipient_email = 'old@example.test'");
        asSuperuser("UPDATE outbox_jobs SET status = 'DEAD', updated_at = now() - interval '29 days' "
            + "WHERE recipient_email = 'recent@example.test'");

        assertThat(outbox.purgeDeadOlderThan(OutboxPurgeJob.KEEP_DEAD_FOR)).isEqualTo(1);
        assertThat(count("recipient_email = 'recent@example.test'")).isEqualTo(1);
    }

    @Test
    void erasureRemovesTheStudiosJobsToOrAboutThePersonAndNoOthers() {
        UUID tenantA = tenantRepository.save(new Tenant("erase-a", "a@erase-test.example")).getId();
        UUID tenantB = tenantRepository.save(new Tenant("erase-b", "b@erase-test.example")).getId();
        outbox.enqueue(entry(tenantA, "Maria@Example.test", null));
        outbox.enqueue(new OutboxEntry(QUEUE, "probe", tenantA,
            "{\"clientEmail\":\"maria@example.test\"}", "owner@studio.test", 5, null, null));
        outbox.enqueue(entry(tenantA, "someone-else@example.test", null));
        outbox.enqueue(entry(tenantB, "maria@example.test", null));

        Integer deleted = new TransactionTemplate(txManager).execute(status ->
            eraser.erase(new ErasureSubject(tenantA, "maria@example.test")).get(0).deleted());

        assertThat(deleted).isEqualTo(2);
        assertThat(count("tenant_id = '" + tenantA + "'")).isEqualTo(1);
        assertThat(count("tenant_id = '" + tenantB + "'")).as("another studio's job is not this erasure's")
            .isEqualTo(1);
    }

    @Test
    void erasureOnlyRunsInsideTheCallersTransaction() {
        assertThatThrownBy(() -> outbox.deleteForPerson(UUID.randomUUID(), "a@example.test"))
            .isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);
    }

    @Test
    void anExpiredJobIsDroppedNotRun() {
        outbox.enqueue(new OutboxEntry(QUEUE, "probe", null, "{}", "a@example.test", 1,
            OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1), null));
        AtomicInteger ran = new AtomicInteger();

        workerWith(handler(job -> ran.incrementAndGet())).drain(QUEUE);

        assertThat(ran).hasValue(0);
        assertThat(count("true")).isZero();
    }

    @Test
    void theOldestWaitingAgeIsReported() {
        outbox.enqueue(entry(null, "a@example.test", null));
        asSuperuser("UPDATE outbox_jobs SET created_at = now() - interval '10 minutes'");

        Outbox.Snapshot snapshot = new Outbox(jdbc, Clock.fixed(Instant.now(), ZoneOffset.UTC), txManager)
            .snapshot();

        assertThat(snapshot.pending()).isEqualTo(1);
        assertThat(snapshot.oldestWaitingSeconds()).isBetween(590L, 700L);
    }

    // ── helpers ─────────────────────────────────────────────────────────

    private void insertClient(UUID tenantId, String email) {
        TenantContext.setTenant(tenantId.toString());
        try {
            new TransactionTemplate(txManager).executeWithoutResult(status -> jdbc.update(
                "INSERT INTO clients (id, tenant_id, email, full_name) VALUES (?, ?, ?, ?)",
                UUID.randomUUID(), tenantId, email, "Test Client"));
        } finally {
            TenantContext.clear();
        }
    }

    private interface JobBody {
        void run(OutboxJob job);
    }

    private static OutboxHandler handler(JobBody body) {
        return new OutboxHandler() {
            @Override
            public String kind() {
                return "probe";
            }

            @Override
            public void handle(OutboxJob job) {
                body.run(job);
            }
        };
    }
}
