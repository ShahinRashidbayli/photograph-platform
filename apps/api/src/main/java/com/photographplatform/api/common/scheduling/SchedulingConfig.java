package com.photographplatform.api.common.scheduling;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
@EnableScheduling
public class SchedulingConfig {

    /**
     * A dedicated scheduler pool, sized above one on purpose.
     *
     * <p>Spring's default scheduler is a single thread. With it, gallery
     * retention — which walks every tenant and can spend a long time deleting
     * objects from R2 — would block every other scheduled task behind it, and
     * a job that hangs on a slow network call would stop the schedule entirely
     * rather than just missing its own tick.
     *
     * <p>Small on purpose too: these are background jobs sharing a connection
     * pool sized at 10 (see {@code spring.datasource.hikari}), and a wide
     * scheduler would starve request threads of connections to do work nobody
     * is waiting for.
     */
    @Bean
    public ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(3);
        scheduler.setThreadNamePrefix("scheduled-");
        // Let an in-flight job finish on shutdown rather than being cut off
        // mid-purge, which would leave R2 objects deleted and rows still
        // claiming they exist.
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(60);
        return scheduler;
    }
}
