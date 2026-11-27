package com.photographplatform.api.common.logging;

import jakarta.servlet.AsyncEvent;
import jakarta.servlet.AsyncListener;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.spi.LoggingEventBuilder;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Gives each request its {@link RequestId} and writes one line when it ends:
 * method, route, status, duration, and who asked.
 *
 * <p>First in the chain, ahead of Spring Security. Both jobs need that: the id
 * has to be in the log context before any other filter can log, and the line
 * has to see requests the security chain turns away — a burst of 401s is
 * exactly what someone diagnosing "I can't log in" needs to find.
 *
 * <p>The line is INFO whatever the status. A failure is logged once, as ERROR,
 * where it is handled ({@code GlobalExceptionHandler}); repeating it here would
 * double every alert that is ever wired to ERROR.
 *
 * <p>The tenant and user are not in the log context by the time the line is
 * written — {@code TenantContextFilter} sets and clears them inside the chain —
 * so it leaves them on the request under the two attributes below.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLoggingFilter extends OncePerRequestFilter {

    public static final String TENANT_ID_ATTRIBUTE = RequestLoggingFilter.class.getName() + ".tenantId";
    public static final String USER_ID_ATTRIBUTE = RequestLoggingFilter.class.getName() + ".userId";

    private static final Logger LOG = LoggerFactory.getLogger(RequestLoggingFilter.class);

    /** Polled every 30 s by the container health check; a line each would be most of the log. */
    private static final String HEALTH = "/actuator/health";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri.equals(HEALTH) || uri.startsWith(HEALTH + "/");
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {
        long started = System.nanoTime();
        String requestId = RequestId.resolve(request.getHeader(RequestId.RAILWAY_HEADER));
        // Before the chain, so a response that is committed early still carries it.
        response.setHeader(RequestId.RESPONSE_HEADER, requestId);

        try (MdcScope scope = MdcScope.open().with(LogFields.REQUEST_ID, requestId)) {
            boolean completed = false;
            try {
                chain.doFilter(request, response);
                completed = true;
            } finally {
                if (request.isAsyncStarted()) {
                    // A streamed response (the gallery ZIP) is still being written
                    // when the chain returns; its status and duration are only
                    // known when the container completes it.
                    request.getAsyncContext().addListener(
                        new LogWhenComplete(request, response, requestId, started));
                } else {
                    // An exception escaping the chain becomes a 500 after this
                    // filter has returned, so the response cannot say so yet.
                    int status = completed || response.isCommitted()
                        ? response.getStatus()
                        : HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
                    logRequest(request, status, started);
                }
            }
        }
    }

    private static void logRequest(HttpServletRequest request, int status, long started) {
        long durationMs = (System.nanoTime() - started) / 1_000_000;
        String method = request.getMethod();
        String route = RequestRoute.of(request);

        LoggingEventBuilder line = LOG.atInfo()
            .addKeyValue(LogFields.HTTP_METHOD, method)
            .addKeyValue(LogFields.ROUTE, route)
            .addKeyValue(LogFields.STATUS, status)
            .addKeyValue(LogFields.DURATION_MS, durationMs);
        Object tenantId = request.getAttribute(TENANT_ID_ATTRIBUTE);
        if (tenantId != null) {
            line = line.addKeyValue(LogFields.TENANT_ID, tenantId);
        }
        Object userId = request.getAttribute(USER_ID_ATTRIBUTE);
        if (userId != null) {
            line = line.addKeyValue(LogFields.USER_ID, userId);
        }
        line.log("{} {} -> {} in {} ms", method, route, status, durationMs);
    }

    /**
     * Writes the line for an async request once the container has finished it.
     * Runs on whatever thread completes the request, so it brings its own
     * request id rather than trusting that thread's log context.
     */
    private static final class LogWhenComplete implements AsyncListener {

        private final HttpServletRequest request;
        private final HttpServletResponse response;
        private final String requestId;
        private final long started;

        private LogWhenComplete(
            HttpServletRequest request, HttpServletResponse response, String requestId, long started) {
            this.request = request;
            this.response = response;
            this.requestId = requestId;
            this.started = started;
        }

        @Override
        public void onComplete(AsyncEvent event) {
            try (MdcScope scope = MdcScope.open().with(LogFields.REQUEST_ID, requestId)) {
                logRequest(request, response.getStatus(), started);
            }
        }

        /** A timeout or error is always followed by {@link #onComplete}, which writes the line. */
        @Override
        public void onTimeout(AsyncEvent event) {
            // See onComplete.
        }

        @Override
        public void onError(AsyncEvent event) {
            // See onComplete.
        }

        /** Restarting async drops the listeners; this one has not written its line yet. */
        @Override
        public void onStartAsync(AsyncEvent event) {
            event.getAsyncContext().addListener(this);
        }
    }
}
