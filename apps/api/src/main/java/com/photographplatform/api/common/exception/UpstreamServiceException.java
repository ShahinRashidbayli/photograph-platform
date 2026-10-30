package com.photographplatform.api.common.exception;

/**
 * A call to a third-party service we depend on (Stripe, today) failed for a
 * reason that is not the caller's doing.
 *
 * <h2>Why this exists rather than {@code IllegalStateException}</h2>
 * The payment paths used to wrap Stripe failures as {@code
 * IllegalStateException("… : " + ex.getMessage())}, which {@code
 * GlobalExceptionHandler} turns into a 500 whose body is the provider's own
 * message. Two problems, and the smaller one is the status code:
 *
 * <ul>
 *   <li>Stripe's messages are written for the integrator, not the payer. They
 *       name connected account ids, capability names, API versions and
 *       rate-limit state — internal topology, handed to whoever clicked Pay.</li>
 *   <li>500 says "this server is broken", so a client retries into the same
 *       wall. 502 says the dependency is what failed, which is both true and
 *       the thing a status page or an alert rule wants to distinguish.</li>
 * </ul>
 *
 * <p>So this carries two messages: {@link #getMessage()} is the safe, generic
 * line the caller sees, and the cause holds the provider's detail for the log.
 * Anything the user can actually <em>act</em> on — Stripe not connected yet, an
 * invoice already paid — is not this exception; those are {@link
 * ConflictException} and stay 409 with a message worth reading.
 */
public class UpstreamServiceException extends RuntimeException {

    private final String service;

    public UpstreamServiceException(String service, String publicMessage, Throwable cause) {
        super(publicMessage, cause);
        this.service = service;
    }

    /** The dependency that failed — for the log line, never for the response. */
    public String getService() {
        return service;
    }
}
