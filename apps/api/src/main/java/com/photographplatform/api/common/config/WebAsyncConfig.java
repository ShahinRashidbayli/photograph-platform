package com.photographplatform.api.common.config;

import com.photographplatform.api.common.logging.MdcTaskDecorator;
import java.util.concurrent.ThreadPoolExecutor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * The thread pool that serves Spring MVC async return values — today, the
 * streamed gallery ZIP.
 *
 * <h2>Why this has to be declared</h2>
 * Spring Boot normally hands MVC its auto-configured {@code
 * applicationTaskExecutor}. That bean is {@code @ConditionalOnMissingBean(Executor.class)},
 * and {@link AsyncConfig} declares an {@code Executor} for {@code @Async} — so
 * Boot backs off and never creates it. With no executor configured, Spring MVC
 * falls back to a plain {@code SimpleAsyncTaskExecutor}, which starts a brand
 * new, unbounded thread per request and never reuses one. A handful of clients
 * downloading wedding galleries at once is enough to exhaust the process.
 *
 * <p>It is deliberately <em>not</em> the {@code @Async} pool either. That pool
 * is sized for short I/O bursts — email sends, thumbnail generation, audit
 * inserts — and a gallery download occupies its thread for minutes. Sharing
 * one pool would let a few downloads starve every background job in the
 * application.
 */
@Configuration
public class WebAsyncConfig implements WebMvcConfigurer {

    /**
     * Small and bounded. Each thread is held for the whole download, so this
     * is a deliberate cap on concurrent archive streams rather than a
     * throughput knob.
     *
     * <p>{@code queueCapacity = 0} means a request either gets a thread now or
     * hits the rejection handler immediately — queueing would leave the
     * browser waiting on an accepted connection with no bytes arriving.
     * {@code CallerRunsPolicy} then streams on the container's own request
     * thread: slower under load, but it degrades to the pre-async behaviour
     * instead of failing the download.
     */
    @Bean
    public AsyncTaskExecutor mvcTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(0);
        executor.setKeepAliveSeconds(60);
        executor.setAllowCoreThreadTimeOut(true);
        executor.setThreadNamePrefix("mvc-stream-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        // The archive writer logs skipped photos and the finished stream; without
        // this those lines lose the download's request_id.
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.initialize();
        return executor;
    }

    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setTaskExecutor(mvcTaskExecutor());
    }
}
