package com.photographplatform.api.common.outbox;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.function.ToDoubleFunction;
import org.springframework.stereotype.Component;

/**
 * Gauges over {@code outbox_jobs}: {@code outbox.jobs{status=pending|running|dead}}
 * and {@code outbox.jobs.oldest.age} (seconds).
 *
 * <p>The alert that matters is {@code dead > 0}: a dead job is an email that
 * was given up on, and nobody else will notice (ADR-005 §6 has the replay SQL).
 * A growing oldest age with nothing dead means the worker is stuck or behind.
 *
 * <p>One query serves all four, cached briefly, so a scrape costs one round
 * trip rather than four.
 */
@Component
public class OutboxMetrics {

    private static final Duration CACHE_FOR = Duration.ofSeconds(10);

    private final Outbox outbox;
    private final Clock clock;
    private Outbox.Snapshot cached;
    private Instant cachedAt = Instant.MIN;

    public OutboxMetrics(Outbox outbox, Clock clock, MeterRegistry meters) {
        this.outbox = outbox;
        this.clock = clock;
        register(meters, "outbox.jobs", "pending", Outbox.Snapshot::pending);
        register(meters, "outbox.jobs", "running", Outbox.Snapshot::running);
        register(meters, "outbox.jobs", "dead", Outbox.Snapshot::dead);
        Gauge.builder("outbox.jobs.oldest.age", this, m -> m.current().oldestWaitingSeconds())
            .baseUnit("seconds")
            .description("Age of the oldest outbox job not yet done")
            .register(meters);
    }

    private void register(MeterRegistry meters, String name, String status,
                          ToDoubleFunction<Outbox.Snapshot> value) {
        Gauge.builder(name, this, m -> value.applyAsDouble(m.current()))
            .tag("status", status)
            .description("Outbox jobs by status")
            .register(meters);
    }

    synchronized Outbox.Snapshot current() {
        Instant now = clock.instant();
        if (cached == null || cachedAt.plus(CACHE_FOR).isBefore(now)) {
            cached = outbox.snapshot();
            cachedAt = now;
        }
        return cached;
    }
}
