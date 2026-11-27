package com.photographplatform.api.common.logging;

import java.util.Map;
import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;

/**
 * Carries the submitting thread's log context onto the thread that runs the
 * task, so a request's lines keep its {@code request_id} after the work leaves
 * the request thread.
 *
 * <p>Only the log context. {@code AsyncConfig}'s decorator also carries the
 * tenant and the principal, which is right for {@code @Async} work and a
 * behaviour change for a pool that has never had them.
 *
 * <p>Restores rather than clears, for the reason given there: under
 * {@code CallerRunsPolicy} the task runs on the submitting request thread,
 * whose own context must survive it.
 */
public final class MdcTaskDecorator implements TaskDecorator {

    @Override
    public Runnable decorate(Runnable runnable) {
        Map<String, String> submitted = MDC.getCopyOfContextMap();
        return () -> {
            Map<String, String> previous = MDC.getCopyOfContextMap();
            install(submitted);
            try {
                runnable.run();
            } finally {
                install(previous);
            }
        };
    }

    private static void install(Map<String, String> context) {
        if (context == null) {
            MDC.clear();
        } else {
            MDC.setContextMap(context);
        }
    }
}
