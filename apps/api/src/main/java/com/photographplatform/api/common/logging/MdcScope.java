package com.photographplatform.api.common.logging;

import java.util.HashMap;
import java.util.Map;
import org.slf4j.MDC;
import org.springframework.lang.Nullable;

/**
 * Adds fields to the log context for a block, then puts back what was there.
 *
 * <p>Restored rather than removed, for the reason {@code OutboxWorker} restores
 * the tenant: the threads that run jobs are pooled, and the same code is also
 * reached from inside a request, whose own fields must survive the block.
 *
 * <pre>{@code
 * try (MdcScope scope = MdcScope.open().with(LogFields.TENANT_ID, id)) {
 *     ...
 * }
 * }</pre>
 */
public final class MdcScope implements AutoCloseable {

    private final Map<String, String> previous = new HashMap<>();

    private MdcScope() {
    }

    public static MdcScope open() {
        return new MdcScope();
    }

    /** Sets {@code key} for the scope; a {@code null} value leaves the field out. */
    public MdcScope with(String key, @Nullable Object value) {
        if (!previous.containsKey(key)) {
            previous.put(key, MDC.get(key));
        }
        if (value == null) {
            MDC.remove(key);
        } else {
            MDC.put(key, value.toString());
        }
        return this;
    }

    @Override
    public void close() {
        previous.forEach((key, value) -> {
            if (value == null) {
                MDC.remove(key);
            } else {
                MDC.put(key, value);
            }
        });
    }
}
