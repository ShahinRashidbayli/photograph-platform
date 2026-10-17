package com.photographplatform.api.common.config;

import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Propagates request-scoped state across {@code @Async} boundaries.
 *
 * <p>{@link TenantContext}, Spring Security's {@code SecurityContext}, and SLF4J
 * MDC all use {@link ThreadLocal} storage. Without a {@link TaskDecorator},
 * an {@code @Async} method runs on a worker thread with empty context — any
 * tenant-scoped query in that path would silently leak across schemas (or
 * worse, run against {@code public} when callers expect tenant isolation).
 *
 * <p>The decorator captures context at submit time on the calling thread and
 * restores it on the worker thread, clearing it again in {@code finally} so
 * the worker can be reused safely for another tenant's task.
 */
@Configuration
public class AsyncConfig implements AsyncConfigurer {

    /** Qualifier for {@code @Async} methods that process uploaded images; see {@link #imageTaskExecutor}. */
    public static final String IMAGE_EXECUTOR = "imageTaskExecutor";

    /**
     * Sized for I/O-bound work, because that is what actually runs here:
     * outbound provider HTTP (email), R2 round-trips (thumbnails) and audit
     * inserts. Threads spend their time waiting on sockets, not on CPU.
     *
     * <p>The previous {@code core=2 / queue=100 / max=8} never used more than
     * two threads. {@link java.util.concurrent.ThreadPoolExecutor} only grows
     * past the core size once the queue is <em>full</em>, so with a
     * 100-deep queue the pool would have had to fall 100 tasks behind before
     * spawning a third thread — {@code maxPoolSize} was effectively dead
     * config, and a burst of email (each a few hundred ms of blocking HTTPS)
     * serialised through two workers.
     *
     * <p>A larger core with a shallower queue inverts that: work gets threads
     * first and queues only when every thread is busy.
     * {@code allowCoreThreadTimeOut} keeps the idle cost at zero, so a bigger
     * core is free when nothing is happening.
     */
    @Override
    @Bean(name = "taskExecutor")
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(24);
        executor.setQueueCapacity(500);
        executor.setKeepAliveSeconds(60);
        executor.setAllowCoreThreadTimeOut(true);
        executor.setThreadNamePrefix("app-async-");
        executor.setTaskDecorator(new ContextPropagatingTaskDecorator());
        // Saturation must not turn into a failed request. The default
        // AbortPolicy throws TaskRejectedException out of the @Async proxy —
        // i.e. at the *caller*, inside its transaction — so an email backlog
        // would have rolled back the registration that triggered it. Running
        // the task on the calling thread degrades to the old inline behaviour
        // under extreme load instead of losing the work, and the resulting
        // back-pressure is self-limiting.
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        // Let queued audit rows and emails finish on shutdown rather than
        // vanishing mid-deploy.
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(20);
        executor.initialize();
        return executor;
    }

    /**
     * The pool that decodes, watermarks and re-encodes uploaded photos.
     *
     * <p>Separate from {@link #getAsyncExecutor()} because its tasks are a
     * different kind of work: each holds a decoded image in heap (up to ~100 MB
     * even with {@code BoundedImageDecoder}'s budget) and keeps a CPU busy for
     * seconds. On the shared pool a 400-photo gallery upload ran up to 24 of
     * them at once and queued every email and audit row behind them.
     *
     * <p>Fixed at {@code app.media.processing-threads} (default 2), so the heap
     * this pool can claim is bounded by a number someone chose, not by how many
     * photos arrived.
     *
     * <p>The queue is unbounded on purpose. A task here is two ids, and
     * nothing re-runs a dropped one — a delivery photo without its derivatives
     * stays invisible in a watermarked gallery until someone toggles the
     * setting. So the queue must never reject, and with nothing rejected the
     * work can never fall back onto the request thread either. A backlog
     * costs latency, which is the right thing for a burst to cost.
     */
    @Bean(name = IMAGE_EXECUTOR)
    public Executor imageTaskExecutor(@Value("${app.media.processing-threads:2}") int threads) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(threads);
        executor.setMaxPoolSize(threads);
        executor.setQueueCapacity(Integer.MAX_VALUE);
        executor.setThreadNamePrefix("image-");
        executor.setTaskDecorator(new ContextPropagatingTaskDecorator());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(20);
        executor.initialize();
        return executor;
    }

    /**
     * Installs the submitting thread's context for the task, then puts back
     * whatever the running thread had before.
     *
     * <p>Restoring rather than clearing matters because the running thread is
     * not always a pool worker: under {@code CallerRunsPolicy} a saturated pool
     * runs the task on the thread that submitted it — a request thread, often
     * mid-transaction. Clearing there wiped that request's tenant, principal
     * and log context, so whatever it did next ran unauthenticated and outside
     * its tenant. On a worker the previous state is empty, so restoring it is
     * the same as clearing.
     */
    static final class ContextPropagatingTaskDecorator implements TaskDecorator {

        @Override
        public Runnable decorate(Runnable runnable) {
            String tenantId = TenantContext.getTenant();
            SecurityContext securityContext = SecurityContextHolder.getContext();
            Map<String, String> mdc = MDC.getCopyOfContextMap();

            return () -> {
                String previousTenant = TenantContext.getTenant();
                SecurityContext previousSecurity = SecurityContextHolder.getContext();
                Map<String, String> previousMdc = MDC.getCopyOfContextMap();
                try {
                    install(tenantId, securityContext, mdc);
                    runnable.run();
                } finally {
                    install(previousTenant, previousSecurity, previousMdc);
                }
            };
        }

        private static void install(String tenantId, SecurityContext security, Map<String, String> mdc) {
            if (tenantId != null && !tenantId.isBlank()) {
                TenantContext.setTenant(tenantId);
            } else {
                TenantContext.clear();
            }
            // getContext() never returns null — it creates an empty context on
            // first use — so an empty one is cleared rather than installed,
            // leaving no context object behind on an idle worker.
            if (security != null && security.getAuthentication() != null) {
                SecurityContextHolder.setContext(security);
            } else {
                SecurityContextHolder.clearContext();
            }
            if (mdc != null) {
                MDC.setContextMap(mdc);
            } else {
                MDC.clear();
            }
        }
    }
}
