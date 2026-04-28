package com.photographplatform.api.common.config;

import java.util.Map;
import java.util.concurrent.Executor;
import org.slf4j.MDC;
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

    @Override
    @Bean(name = "taskExecutor")
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("app-async-");
        executor.setTaskDecorator(new ContextPropagatingTaskDecorator());
        executor.initialize();
        return executor;
    }

    static final class ContextPropagatingTaskDecorator implements TaskDecorator {

        @Override
        public Runnable decorate(Runnable runnable) {
            String tenantId = TenantContext.getTenant();
            SecurityContext securityContext = SecurityContextHolder.getContext();
            Map<String, String> mdc = MDC.getCopyOfContextMap();

            return () -> {
                try {
                    if (tenantId != null && !tenantId.isBlank()) {
                        TenantContext.setTenant(tenantId);
                    }
                    SecurityContextHolder.setContext(securityContext);
                    if (mdc != null) {
                        MDC.setContextMap(mdc);
                    }
                    runnable.run();
                } finally {
                    TenantContext.clear();
                    SecurityContextHolder.clearContext();
                    MDC.clear();
                }
            };
        }
    }
}
