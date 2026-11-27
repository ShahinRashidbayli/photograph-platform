package com.photographplatform.api.common.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.photographplatform.api.common.logging.RequestId;
import java.time.OffsetDateTime;
import java.util.Map;

/**
 * The one shape every error leaves this API in.
 *
 * <p>There used to be three. Application errors answered {@code {"error": …}},
 * the security filter chain answered Boot's default
 * {@code {"timestamp","status","error","path"}} — where {@code error} is the
 * status <em>name</em>, not a message — and the plan gates answered a third
 * shape with extra fields. The frontend reads {@code data.error} everywhere, so
 * a request denied by the filter chain rendered the literal word "Forbidden" at
 * the user.
 *
 * <p>{@code error} is therefore always a sentence written for a person, and
 * {@link #code} is always present for the client to branch on. Field order here
 * is the JSON order: code first, because that is what a client reads.
 *
 * @param error     human-readable message, safe to display
 * @param code      stable machine-readable code, see {@link ErrorCode}
 * @param timestamp when the failure was answered
 * @param path      the request URI that failed
 * @param details   extra structured context for codes that carry it (the
 *                  capability and tier behind a {@code PLAN_UPGRADE_REQUIRED},
 *                  the failing field behind a {@code VALIDATION_FAILED});
 *                  omitted from the JSON entirely when there is none
 * @param requestId the {@link RequestId} of the failed request — what a user
 *                  quotes to support, and what finds the request's log lines;
 *                  taken from the log context so every error carries it
 *                  without each handler remembering to
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
    String code,
    String error,
    OffsetDateTime timestamp,
    String path,
    Map<String, Object> details,
    String requestId
) {

    public static ErrorResponse of(String code, String message, String path, OffsetDateTime now) {
        return new ErrorResponse(code, message, now, path, null, RequestId.current());
    }

    public static ErrorResponse of(
        String code, String message, String path, OffsetDateTime now, Map<String, Object> details) {
        return new ErrorResponse(code, message, now, path, details, RequestId.current());
    }
}
