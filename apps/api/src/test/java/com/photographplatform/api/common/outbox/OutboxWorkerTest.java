package com.photographplatform.api.common.outbox;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.logging.LogFields;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * What the worker does with each claimed job: run it, retry it on the
 * schedule, give up on it, or drop it unrun. The claim itself is SQL and is
 * covered against Postgres in {@link OutboxIT}.
 */
class OutboxWorkerTest {

    private static final Instant NOW = Instant.parse("2026-11-25T10:00:00Z");
    private static final OffsetDateTime NOW_ODT = NOW.atOffset(ZoneOffset.UTC);
    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-0000000000aa");

    private final Outbox outbox = mock(Outbox.class);
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
    private final RecordingHandler handler = new RecordingHandler();
    private OutboxWorker worker;

    @BeforeEach
    void setUp() {
        worker = new OutboxWorker(outbox, List.of(handler), Clock.fixed(NOW, ZoneOffset.UTC), meters);
    }

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
        MDC.clear();
    }

    private void claims(OutboxJob... jobs) {
        when(outbox.claim("q", OutboxWorker.MAX_ATTEMPTS)).thenReturn(List.of(jobs)).thenReturn(List.of());
    }

    private static OutboxJob job(String kind, int attempts, OffsetDateTime expiresAt) {
        return new OutboxJob(UUID.randomUUID(), kind, TENANT, "{}", "a@example.test", 1, attempts, expiresAt);
    }

    @Test
    void aJobThatRunsIsDeleted() {
        OutboxJob job = job("probe", 1, null);
        claims(job);

        assertThat(worker.drain("q")).isEqualTo(1);

        assertThat(handler.ran).containsExactly(job.id());
        verify(outbox).delete(job.id());
        verify(outbox, never()).retryAt(any(), any(), anyString());
    }

    @Test
    void theFirstFailureIsRetriedAMinuteLater() {
        handler.failWith = new IllegalStateException("provider said 503 to a@example.test");
        OutboxJob job = job("probe", 1, null);
        claims(job);

        worker.drain("q");

        verify(outbox).retryAt(job.id(), NOW_ODT.plus(Duration.ofMinutes(1)), "IllegalStateException");
        verify(outbox, never()).delete(job.id());
    }

    @Test
    void retriesBackOffOnTheSchedule() {
        handler.failWith = new IllegalStateException();
        List<Duration> waits = new ArrayList<>();
        for (int attempt = 1; attempt <= OutboxWorker.BACKOFF.size(); attempt++) {
            OutboxJob job = job("probe", attempt, null);
            claims(job);
            worker.drain("q");
            waits.add(OutboxWorker.BACKOFF.get(attempt - 1));
            verify(outbox).retryAt(eq(job.id()), eq(NOW_ODT.plus(waits.get(attempt - 1))), anyString());
        }
        assertThat(waits).containsExactly(
            Duration.ofMinutes(1), Duration.ofMinutes(5), Duration.ofMinutes(30),
            Duration.ofHours(2), Duration.ofHours(12));
    }

    @Test
    void theFailureAfterTheLastRetryIsDead() {
        handler.failWith = new IllegalStateException();
        OutboxJob job = job("probe", OutboxWorker.BACKOFF.size() + 1, null);
        claims(job);

        worker.drain("q");

        verify(outbox).markDead(job.id(), "IllegalStateException");
        verify(outbox, never()).retryAt(any(), any(), anyString());
        assertThat(meters.counter("outbox.jobs.processed",
            "queue", "q", "kind", "probe", "outcome", "dead").count()).isEqualTo(1);
    }

    @Test
    void anExpiredJobIsDroppedWithoutRunning() {
        OutboxJob job = job("probe", 1, NOW_ODT.minusSeconds(1));
        claims(job);

        worker.drain("q");

        assertThat(handler.ran).isEmpty();
        verify(outbox).delete(job.id());
    }

    @Test
    void aJobNobodyCanRunIsParkedAsDead() {
        OutboxJob job = job("unknown-kind", 1, null);
        claims(job);

        worker.drain("q");

        verify(outbox).markDead(job.id(), "No handler for kind unknown-kind");
    }

    @Test
    void theJobsTenantIsBoundWhileItRunsAndRestoredAfter() {
        TenantContext.setTenant("someone-else");
        claims(job("probe", 1, null));

        worker.drain("q");

        assertThat(handler.tenantSeen).isEqualTo(TENANT.toString());
        assertThat(TenantContext.getTenant()).isEqualTo("someone-else");
    }

    /** What links a failed send back to the request that queued it. */
    @Test
    void everyLineTheJobWritesNamesTheJobItsKindAndItsTenant() {
        MDC.put(LogFields.TENANT_ID, "someone-else");
        OutboxJob job = job("probe", 1, null);
        claims(job);

        worker.drain("q");

        assertThat(handler.logContextSeen)
            .containsEntry(LogFields.OUTBOX_JOB_ID, job.id().toString())
            .containsEntry(LogFields.OUTBOX_KIND, "probe")
            .containsEntry(LogFields.TENANT_ID, TENANT.toString());
        assertThat(MDC.get(LogFields.TENANT_ID)).isEqualTo("someone-else");
        assertThat(MDC.get(LogFields.OUTBOX_JOB_ID)).isNull();
    }

    @Test
    void theStoredErrorIsWhatTheHandlerDescribesNotTheMessage() {
        handler.failWith = new IllegalStateException("secret subject: Your sign-in code: 123456");
        OutboxJob job = job("probe", 1, null);
        claims(job);

        worker.drain("q");

        verify(outbox).retryAt(eq(job.id()), any(), eq("IllegalStateException"));
    }

    @Test
    void jobsLeftWhenTheLeaseRunsLowAreReleasedUnrun() {
        // Each send takes two minutes, so after the first two the third would
        // start with under a job's budget of the five-minute lease left.
        MutableClock clock = new MutableClock(NOW);
        List<UUID> ran = new ArrayList<>();
        OutboxHandler slow = new OutboxHandler() {
            @Override
            public String kind() {
                return "probe";
            }

            @Override
            public void handle(OutboxJob job) {
                ran.add(job.id());
                clock.advance(Duration.ofMinutes(2));
            }
        };
        worker = new OutboxWorker(outbox, List.of(slow), clock, meters);
        OutboxJob first = job("probe", 1, null);
        OutboxJob second = job("probe", 1, null);
        OutboxJob third = job("probe", 1, null);
        OutboxJob fourth = job("probe", 1, null);
        claims(first, second, third, fourth);

        assertThat(worker.drain("q")).isEqualTo(2);

        assertThat(ran).containsExactly(first.id(), second.id());
        verify(outbox).release(List.of(third.id(), fourth.id()));
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration by) {
            now = now.plus(by);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }
    }

    private static final class RecordingHandler implements OutboxHandler {
        final List<UUID> ran = new ArrayList<>();
        String tenantSeen;
        Map<String, String> logContextSeen;
        RuntimeException failWith;

        @Override
        public String kind() {
            return "probe";
        }

        @Override
        public void handle(OutboxJob job) {
            tenantSeen = TenantContext.getTenant();
            logContextSeen = MDC.getCopyOfContextMap();
            if (failWith != null) {
                throw failWith;
            }
            ran.add(job.id());
        }
    }
}
