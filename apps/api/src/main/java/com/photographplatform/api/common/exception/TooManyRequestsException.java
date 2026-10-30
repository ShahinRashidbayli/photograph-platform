package com.photographplatform.api.common.exception;

import java.time.Duration;

/**
 * The caller has exceeded a rate limit or tripped a lockout.
 *
 * <p>Optionally carries how long the caller must wait. That matters because a
 * 429 without a duration is barely more useful than a generic failure: the
 * person is told to try again later without being told when later is, so they
 * retry immediately, fail again, and conclude the product is broken. When
 * present, {@link #getRetryAfter()} becomes the {@code Retry-After} header and
 * a {@code retryAfterSeconds} detail on the error body — see
 * {@link GlobalExceptionHandler}.
 */
public class TooManyRequestsException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** How long until the caller may retry, or null when it isn't known. */
    private final transient Duration retryAfter;

    public TooManyRequestsException(String message) {
        this(message, (Duration) null);
    }

    public TooManyRequestsException(String message, Duration retryAfter) {
        super(message);
        this.retryAfter = retryAfter;
    }

    public TooManyRequestsException(String message, Throwable cause) {
        super(message, cause);
        this.retryAfter = null;
    }

    public Duration getRetryAfter() {
        return retryAfter;
    }
}
