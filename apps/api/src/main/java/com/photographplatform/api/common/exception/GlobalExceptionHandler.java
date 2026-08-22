package com.photographplatform.api.common.exception;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String ERROR_KEY = "error";

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Map<String, String>> handleConflict(ConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(ERROR_KEY, ex.getMessage()));
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<Map<String, String>> handleUnauthorized(UnauthorizedException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(ERROR_KEY, ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(ERROR_KEY, "Forbidden"));
    }

    @ExceptionHandler(EmailNotVerifiedException.class)
    public ResponseEntity<Map<String, String>> handleEmailNotVerified(EmailNotVerifiedException ex) {
        // Structured `code` lets the FE distinguish this from a generic 403 and
        // surface a "verify your email" prompt instead of a permission error.
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
            ERROR_KEY, ex.getMessage(),
            "code", "EMAIL_NOT_VERIFIED"
        ));
    }

    /**
     * The tenant's plan does not include this feature. 402 + a structured
     * {@code code} so the frontend renders an upgrade prompt naming the tier,
     * not a generic "Forbidden" — see PlanUpgradeRequiredException.
     */
    @ExceptionHandler(PlanUpgradeRequiredException.class)
    public ResponseEntity<Map<String, String>> handlePlanUpgradeRequired(PlanUpgradeRequiredException ex) {
        return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(Map.of(
            ERROR_KEY, ex.getMessage(),
            "code", "PLAN_UPGRADE_REQUIRED",
            "capability", ex.getCapability().name(),
            "requiredPlan", ex.getRequiredPlan().name()
        ));
    }

    /**
     * Trial expired or subscription lapsed: reads still work, writes do not.
     */
    @ExceptionHandler(AccountReadOnlyException.class)
    public ResponseEntity<Map<String, String>> handleAccountReadOnly(AccountReadOnlyException ex) {
        return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(Map.of(
            ERROR_KEY, ex.getMessage(),
            "code", "ACCOUNT_READ_ONLY"
        ));
    }

    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<Map<String, String>> handleTooManyRequests(TooManyRequestsException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(ERROR_KEY, ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(ERROR_KEY, ex.getMessage()));
    }

    /**
     * A dependency failed, not us. The response carries only the generic line
     * the exception was constructed with — the provider's own message went
     * into the cause and stays in the log, because it is written for an
     * integrator and routinely names account ids, capabilities and API
     * versions that have no business reaching a payer's browser.
     */
    @ExceptionHandler(UpstreamServiceException.class)
    public ResponseEntity<Map<String, String>> handleUpstream(UpstreamServiceException ex) {
        LOG.error("Upstream service {} failed", ex.getService(), ex);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(ERROR_KEY, ex.getMessage()));
    }

    /**
     * The catch-all for "this should not have happened". Logged in full;
     * answered with a fixed line, because an unplanned exception's message is
     * by definition not something anyone wrote for a user to read, and echoing
     * it has handed out connection strings and file paths in enough systems to
     * be worth refusing on principle.
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException ex) {
        LOG.error("Unexpected illegal state", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of(ERROR_KEY, "Something went wrong on our side. Please try again."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .findFirst()
            .orElse("Validation failed");
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of(ERROR_KEY, message));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrity(DataIntegrityViolationException ex) {
        // Likely race on a unique constraint (subdomain/email). Treat as conflict
        // and avoid leaking column names or constraint identifiers.
        LOG.warn("Data integrity violation", ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(Map.of(ERROR_KEY, "Resource already exists"));
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(NotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(ERROR_KEY, ex.getMessage()));
    }

    // Last-resort handler. Without this an uncaught exception falls through to
    // Spring's default error mapping, which renders an HTML error page that the
    // FE cannot consume. Log the cause server-side; return a generic message so
    // we do not leak stack traces, table names, or framework internals.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception ex) {
        LOG.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of(ERROR_KEY, "Internal server error"));
    }
}
