package com.photographplatform.api.common.exception;

/**
 * The machine-readable half of every error response.
 *
 * <p>Before this existed, only three of the twelve error paths carried a
 * {@code code} and the rest were distinguishable only by their prose. The
 * frontend was therefore matching on message strings — which breaks the moment
 * a message is reworded or translated, silently and in the direction of
 * "handled" becoming "unhandled".
 *
 * <p>The status code alone is not enough either: 409 covers "already paid",
 * "already storniert" and "subdomain taken", and 402 covers both an expired
 * trial and a plan gate. Those need different screens.
 *
 * <p>Codes are part of the API contract. Rename one and you break a client;
 * add one freely.
 *
 * @see ErrorResponse
 * @see GlobalExceptionHandler
 */
public final class ErrorCode {

    /** No credentials, or credentials that no longer authenticate. */
    public static final String UNAUTHORIZED = "UNAUTHORIZED";

    /** Authenticated, but this identity may not do this. */
    public static final String FORBIDDEN = "FORBIDDEN";

    /** The addressed thing does not exist, or is not visible to this caller. */
    public static final String NOT_FOUND = "NOT_FOUND";

    /** Bean-validation rejected the request body. */
    public static final String VALIDATION_FAILED = "VALIDATION_FAILED";

    /** Hand-rolled input validation in a service rejected the request. */
    public static final String INVALID_REQUEST = "INVALID_REQUEST";

    /**
     * The request could not be read: a body that is not JSON or not in a
     * content type the endpoint reads, a value of the wrong type for its field
     * or parameter, a missing required parameter. 400 (415 for the content
     * type), where {@link #VALIDATION_FAILED} and {@link #INVALID_REQUEST} are
     * 422: those requests were read and broke a rule.
     */
    public static final String MALFORMED_REQUEST = "MALFORMED_REQUEST";

    /** The request is valid but conflicts with current state. */
    public static final String CONFLICT = "CONFLICT";

    /** A unique constraint rejected the write — usually a race on the same key. */
    public static final String ALREADY_EXISTS = "ALREADY_EXISTS";

    /**
     * Someone else changed the row between this caller reading it and writing
     * it. Distinct from {@link #CONFLICT}: nothing about the request was wrong,
     * and a plain retry against the fresh state is the correct client response.
     */
    public static final String CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION";

    /** Rate limit or lockout. */
    public static final String TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS";

    /** The caller must verify their email address first. */
    public static final String EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";

    /** The tenant's plan does not include this feature. */
    public static final String PLAN_UPGRADE_REQUIRED = "PLAN_UPGRADE_REQUIRED";

    /** Trial expired or subscription lapsed: reads work, writes do not. */
    public static final String ACCOUNT_READ_ONLY = "ACCOUNT_READ_ONLY";

    /** A dependency failed, not us. */
    public static final String UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE";

    /** The catch-all. Never carries detail from the underlying exception. */
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";

    private ErrorCode() {
    }
}
