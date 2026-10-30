package com.photographplatform.api.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Every error this API answers, in one shape.
 *
 * <p>See {@link ErrorResponse} for why the shape was unified and
 * {@link ErrorCode} for why a machine-readable code is mandatory rather than
 * optional. The security filter chain runs before this advice can see anything,
 * so it produces the same shape independently — see
 * {@code common.security.RestAuthenticationEntryPoint}.
 *
 * <h2>Status codes</h2>
 * Invalid input is <em>always</em> 422. It used to be 422 when bean validation
 * caught it and 400 when a service did — the same class of problem answered two
 * ways depending on which layer happened to notice, which made the status
 * useless for deciding anything.
 *
 * <p>422 rather than 400 because that is the answer this API already gave, in
 * six tested places: the body parsed fine and was well-formed, it just asked
 * for something the rules do not allow. 400 stays what it should be — a request
 * the server could not parse at all, which Spring answers before reaching here.
 * The two validation sources are told apart by {@code VALIDATION_FAILED} vs
 * {@code INVALID_REQUEST}, which is what a client should branch on anyway.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final Clock clock;

    public GlobalExceptionHandler(Clock clock) {
        this.clock = clock;
    }

    // ── 4xx: the caller can act on these ──────────────────────────────────────

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ErrorResponse> handleUnauthorized(
        UnauthorizedException ex, HttpServletRequest request) {
        return respond(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, ex.getMessage(), request);
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(
        NotFoundException ex, HttpServletRequest request) {
        return respond(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, ex.getMessage(), request);
    }

    /**
     * No controller claimed the path, so Spring handed it to the static
     * resource handler, which found no file either. That is a plain 404 — a
     * client asking for a route this build does not have — but without this
     * handler it fell through to the catch-all below and was logged as an
     * unhandled 500 with a full stack trace, which buries real failures and
     * tells the caller the server broke when it did not.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(
        NoResourceFoundException ex, HttpServletRequest request) {
        LOG.debug("No handler for {} {}", request.getMethod(), request.getRequestURI());
        return respond(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND,
            "That endpoint does not exist.", request);
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(
        ConflictException ex, HttpServletRequest request) {
        return respond(HttpStatus.CONFLICT, ErrorCode.CONFLICT, ex.getMessage(), request);
    }

    /**
     * Rate limit or lockout. When the exception knows how long the wait is, that
     * duration is answered twice: as the standard {@code Retry-After} header for
     * machine clients, and as a {@code retryAfterSeconds} detail so the UI can
     * say "try again in 12 minutes" instead of an unactionable "too many
     * requests". Without it the caller retries straight away and reads the
     * second failure as a broken product rather than as a wait.
     */
    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<ErrorResponse> handleTooManyRequests(
        TooManyRequestsException ex, HttpServletRequest request) {
        Duration retryAfter = ex.getRetryAfter();
        if (retryAfter == null || retryAfter.isNegative() || retryAfter.isZero()) {
            return respond(
                HttpStatus.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS, ex.getMessage(),
                request);
        }
        // Round up: a 90-second wait reported as 1 minute invites a retry that
        // is still refused.
        long seconds = (long) Math.ceil(retryAfter.toMillis() / 1000.0);
        return respond(
            HttpStatus.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS, ex.getMessage(), request,
            Map.of("retryAfterSeconds", seconds),
            headers -> headers.set(HttpHeaders.RETRY_AFTER, String.valueOf(seconds)));
    }

    /**
     * Hand-rolled validation from a service — a reserved subdomain, a malformed
     * one, an empty name. Same status as bean validation below, because it is
     * the same kind of failure; the {@code code} is what tells the two apart.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(
        IllegalArgumentException ex, HttpServletRequest request) {
        return respond(
            HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.INVALID_REQUEST, ex.getMessage(), request);
    }

    /**
     * Bean validation. Carries the offending field in {@code details} rather
     * than only folding it into the message, so a form can highlight the input
     * that failed instead of showing a banner.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
        MethodArgumentNotValidException ex, HttpServletRequest request) {
        FieldError first = ex.getBindingResult().getFieldErrors().stream().findFirst().orElse(null);
        String message = first == null
            ? "Validation failed"
            : first.getField() + ": " + first.getDefaultMessage();

        Map<String, Object> details = new LinkedHashMap<>();
        if (first != null) {
            details.put("field", first.getField());
        }
        // Every failing field, so a form can mark all of them in one pass
        // instead of making the user resubmit to discover the next one.
        Map<String, Object> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
            .forEach(e -> fields.putIfAbsent(e.getField(), e.getDefaultMessage()));
        if (!fields.isEmpty()) {
            details.put("fields", fields);
        }

        return respond(
            HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.VALIDATION_FAILED, message, request,
            details.isEmpty() ? null : details);
    }

    /**
     * Optimistic-lock failure (V30): the row moved under a check-then-act.
     *
     * <p>409 rather than 500 because nothing is broken and nothing about the
     * request was invalid — two people acted on the same booking, lead or
     * inquiry at once and this one lost. Its own code, because the right client
     * response is "reload and try again", which is not what the other 409s
     * mean.
     */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLock(
        OptimisticLockingFailureException ex, HttpServletRequest request) {
        LOG.info("Concurrent modification on {}", request.getRequestURI());
        return respond(
            HttpStatus.CONFLICT, ErrorCode.CONCURRENT_MODIFICATION,
            "Someone else changed this while you were editing it — reload and try again.",
            request);
    }

    /**
     * Likely a race on a unique constraint (subdomain / email). Answered as a
     * conflict without echoing the column or constraint name.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(
        DataIntegrityViolationException ex, HttpServletRequest request) {
        LOG.warn("Data integrity violation on {}", request.getRequestURI(), ex);
        return respond(
            HttpStatus.CONFLICT, ErrorCode.ALREADY_EXISTS, "Resource already exists", request);
    }

    // ── 4xx with product meaning ─────────────────────────────────────────────

    @ExceptionHandler(EmailNotVerifiedException.class)
    public ResponseEntity<ErrorResponse> handleEmailNotVerified(
        EmailNotVerifiedException ex, HttpServletRequest request) {
        return respond(
            HttpStatus.FORBIDDEN, ErrorCode.EMAIL_NOT_VERIFIED, ex.getMessage(), request);
    }

    /**
     * The tenant's plan does not include this feature. 402 with the capability
     * and the cheapest tier that grants it, so the UI can name the tier instead
     * of saying "upgrade" into the void.
     */
    @ExceptionHandler(PlanUpgradeRequiredException.class)
    public ResponseEntity<ErrorResponse> handlePlanUpgradeRequired(
        PlanUpgradeRequiredException ex, HttpServletRequest request) {
        // A quantity limit (seats) carries no capability — see the second
        // constructor. Omitted rather than sent as null, so the field's
        // presence is what tells the two kinds of upgrade prompt apart.
        Map<String, Object> details = ex.getCapability() == null
            ? Map.of("requiredPlan", ex.getRequiredPlan())
            : Map.of(
                "capability", ex.getCapability(),
                "requiredPlan", ex.getRequiredPlan());
        return respond(
            HttpStatus.PAYMENT_REQUIRED, ErrorCode.PLAN_UPGRADE_REQUIRED, ex.getMessage(), request,
            details);
    }

    /** Trial expired or subscription lapsed: reads still work, writes do not. */
    @ExceptionHandler(AccountReadOnlyException.class)
    public ResponseEntity<ErrorResponse> handleAccountReadOnly(
        AccountReadOnlyException ex, HttpServletRequest request) {
        return respond(
            HttpStatus.PAYMENT_REQUIRED, ErrorCode.ACCOUNT_READ_ONLY, ex.getMessage(), request);
    }

    // ── 5xx: ours ────────────────────────────────────────────────────────────

    /**
     * A dependency failed, not us. The response carries only the generic line
     * the exception was constructed with — the provider's own message went into
     * the cause and stays in the log, because it is written for an integrator
     * and routinely names account ids, capabilities and API versions that have
     * no business reaching a payer's browser.
     */
    @ExceptionHandler(UpstreamServiceException.class)
    public ResponseEntity<ErrorResponse> handleUpstream(
        UpstreamServiceException ex, HttpServletRequest request) {
        LOG.error("Upstream service {} failed", ex.getService(), ex);
        return respond(
            HttpStatus.BAD_GATEWAY, ErrorCode.UPSTREAM_UNAVAILABLE, ex.getMessage(), request);
    }

    /**
     * The catch-all for "this should not have happened". Logged in full;
     * answered with a fixed line, because an unplanned exception's message is by
     * definition not something anyone wrote for a user to read, and echoing it
     * has handed out connection strings and file paths in enough systems to be
     * worth refusing on principle.
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(
        IllegalStateException ex, HttpServletRequest request) {
        LOG.error("Unexpected illegal state on {}", request.getRequestURI(), ex);
        return respond(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR,
            "Something went wrong on our side. Please try again.", request);
    }

    /**
     * Last resort. Without this, an uncaught exception falls through to Spring's
     * default error mapping, which renders an HTML page the frontend cannot
     * consume.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(
        Exception ex, HttpServletRequest request) {
        LOG.error("Unhandled exception on {}", request.getRequestURI(), ex);
        return respond(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR,
            "Something went wrong on our side. Please try again.", request);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private ResponseEntity<ErrorResponse> respond(
        HttpStatus status, String code, String message, HttpServletRequest request) {
        return respond(status, code, message, request, null);
    }

    private ResponseEntity<ErrorResponse> respond(
        HttpStatus status, String code, String message, HttpServletRequest request,
        Map<String, Object> details) {
        return respond(status, code, message, request, details, null);
    }

    private ResponseEntity<ErrorResponse> respond(
        HttpStatus status, String code, String message, HttpServletRequest request,
        Map<String, Object> details, Consumer<HttpHeaders> headerCustomiser) {
        // A null message would serialise as a missing `error` field and leave
        // the frontend with nothing to show.
        String safeMessage = (message == null || message.isBlank())
            ? status.getReasonPhrase()
            : message;
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status);
        if (headerCustomiser != null) {
            builder = builder.headers(headerCustomiser::accept);
        }
        return builder.body(ErrorResponse.of(
            code, safeMessage, request.getRequestURI(), OffsetDateTime.now(clock), details));
    }
}
