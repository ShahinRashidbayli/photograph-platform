package com.photographplatform.api.common.logging;

import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import static org.assertj.core.api.Assertions.assertThat;

/** The gallery ZIP streams on its own pool; its lines must keep the download's request id. */
class MdcTaskDecoratorTest {

    private final MdcTaskDecorator decorator = new MdcTaskDecorator();

    @AfterEach
    void clearThread() {
        MDC.clear();
    }

    @Test
    void theWorkerLogsUnderTheSubmittersRequestAndIsEmptyAfterwards() throws InterruptedException {
        MDC.put(LogFields.REQUEST_ID, "req-1");
        AtomicReference<String> seen = new AtomicReference<>();
        Runnable task = decorator.decorate(() -> seen.set(MDC.get(LogFields.REQUEST_ID)));
        AtomicReference<Map<String, String>> after = new AtomicReference<>();

        Thread worker = new Thread(() -> {
            task.run();
            after.set(MDC.getCopyOfContextMap());
        });
        worker.start();
        worker.join();

        assertThat(seen.get()).isEqualTo("req-1");
        assertThat(after.get()).isNullOrEmpty();
    }

    /** {@code CallerRunsPolicy}: a saturated pool runs the task on the request thread itself. */
    @Test
    void runOnTheSubmittingThreadItLeavesThatThreadsContextAsItWas() {
        MDC.put(LogFields.REQUEST_ID, "req-1");
        Runnable task = decorator.decorate(() -> MDC.put(LogFields.JOB, "leaked"));

        task.run();

        assertThat(MDC.get(LogFields.REQUEST_ID)).isEqualTo("req-1");
        assertThat(MDC.get(LogFields.JOB)).isNull();
    }
}
