package com.photographplatform.api.common.logging;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import static org.assertj.core.api.Assertions.assertThat;

class MdcScopeTest {

    @AfterEach
    void clearThread() {
        MDC.clear();
    }

    @Test
    void fieldsHoldForTheBlockAndAreGoneAfterIt() {
        try (MdcScope scope = MdcScope.open().with(LogFields.TENANT_ID, "t-1").with(LogFields.JOB, "purge")) {
            assertThat(MDC.get(LogFields.TENANT_ID)).isEqualTo("t-1");
            assertThat(MDC.get(LogFields.JOB)).isEqualTo("purge");
        }

        assertThat(MDC.getCopyOfContextMap()).isNullOrEmpty();
    }

    /** A job reached from inside a request must hand the request its own fields back. */
    @Test
    void whatWasThereBeforeIsPutBackNotRemoved() {
        MDC.put(LogFields.REQUEST_ID, "req-1");
        MDC.put(LogFields.TENANT_ID, "outer");

        try (MdcScope scope = MdcScope.open().with(LogFields.TENANT_ID, "inner")) {
            assertThat(MDC.get(LogFields.TENANT_ID)).isEqualTo("inner");
        }

        assertThat(MDC.get(LogFields.TENANT_ID)).isEqualTo("outer");
        assertThat(MDC.get(LogFields.REQUEST_ID)).isEqualTo("req-1");
    }

    @Test
    void aNullValueLeavesTheFieldOutForTheBlock() {
        MDC.put(LogFields.USER_ID, "outer");
        AtomicReference<Map<String, String>> inside = new AtomicReference<>();

        try (MdcScope scope = MdcScope.open().with(LogFields.USER_ID, null)) {
            inside.set(new HashMap<>(MDC.getCopyOfContextMap()));
        }

        assertThat(inside.get()).doesNotContainKey(LogFields.USER_ID);
        assertThat(MDC.get(LogFields.USER_ID)).isEqualTo("outer");
    }
}
