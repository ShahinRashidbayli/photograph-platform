package com.photographplatform.api.common.logging;

/**
 * The names of the fields a log line carries beside its message.
 *
 * <p>In production every one of these becomes a top-level JSON attribute,
 * which is what the log explorer filters on ({@code @tenant_id:…}). A field
 * spelled two ways is two fields that never match each other's filter, so the
 * names live here once. {@code snake_case}, because that is what the first of
 * them ({@code tenant_id}) was already called.
 *
 * <p>Only identifiers belong in these fields — never an email, a name, an IP
 * address or a token. See {@code .claude/rules/api.md}, "Logging".
 */
public final class LogFields {

    /** One HTTP request, end to end; see {@link RequestId}. */
    public static final String REQUEST_ID = "request_id";
    public static final String TENANT_ID = "tenant_id";
    public static final String USER_ID = "user_id";

    /** The scheduled job a line was written under, as named to {@code TenantJobRunner}. */
    public static final String JOB = "job";
    public static final String OUTBOX_JOB_ID = "outbox_job_id";
    /** Prefixed because a bare {@code kind} would collide with the next thing that has kinds. */
    public static final String OUTBOX_KIND = "outbox_kind";

    // The access line's own fields.
    public static final String HTTP_METHOD = "method";
    public static final String ROUTE = "route";
    public static final String STATUS = "status";
    public static final String DURATION_MS = "duration_ms";

    private LogFields() {
    }
}
