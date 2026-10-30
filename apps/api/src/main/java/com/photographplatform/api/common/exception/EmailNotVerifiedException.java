package com.photographplatform.api.common.exception;

/**
 * Thrown when an authenticated user attempts an action that requires a
 * verified email address. Mapped to HTTP 403 with a structured error code
 * so the frontend can show a contextual "verify your email" prompt.
 */
public class EmailNotVerifiedException extends RuntimeException {
    public EmailNotVerifiedException(String message) {
        super(message);
    }
}
