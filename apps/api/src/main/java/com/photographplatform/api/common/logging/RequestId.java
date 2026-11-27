package com.photographplatform.api.common.logging;

import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.lang.Nullable;

/**
 * The id that ties together every log line one HTTP request produced.
 *
 * <p>Railway's edge stamps each request with {@code X-Railway-Request-Id} and
 * records it in its own HTTP logs, so reusing that value lets one search find
 * both the edge's view of a request and ours. Without the header — locally, in
 * tests, behind any other proxy — a UUID is minted instead.
 *
 * <p>The header is client-reachable (nothing stops a caller sending it), so it
 * is only adopted when it looks like an id. Anything else — a newline that
 * would forge a second log line in plain-text output, a kilobyte of padding —
 * is ignored rather than cleaned up. The worst a caller can do with a
 * well-formed value is collide with another request's id, which costs a
 * confusing search, not a security property.
 */
public final class RequestId {

    /** Returned on every response, so a caller can quote the id back. */
    public static final String RESPONSE_HEADER = "X-Request-Id";
    public static final String RAILWAY_HEADER = "X-Railway-Request-Id";

    private static final Pattern ACCEPTABLE = Pattern.compile("[A-Za-z0-9._-]{1,64}");

    private RequestId() {
    }

    /** The edge's id when it is acceptable, otherwise a fresh one. */
    public static String resolve(@Nullable String railwayHeader) {
        if (railwayHeader != null && ACCEPTABLE.matcher(railwayHeader).matches()) {
            return railwayHeader;
        }
        return UUID.randomUUID().toString();
    }

    /** The current request's id, or {@code null} outside a request (a scheduled job, a test). */
    @Nullable
    public static String current() {
        return MDC.get(LogFields.REQUEST_ID);
    }
}
