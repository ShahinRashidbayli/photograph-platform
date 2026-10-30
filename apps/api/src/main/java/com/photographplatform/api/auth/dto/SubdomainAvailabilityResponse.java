package com.photographplatform.api.auth.dto;

/**
 * Whether a subdomain can be claimed, answered before the sign-up form is
 * submitted.
 *
 * <p>Without this the only way to learn that {@code anna-foto} was taken was to
 * fill in the whole form and be refused by a 409 — the one field on the page
 * whose validity the user cannot possibly know in advance, discovered last.
 *
 * <p>{@code reason} is a code, not prose: the frontend has to say this in two
 * languages, and a taken name and a reserved one deserve different advice.
 * Null exactly when {@code available} is true.
 *
 * <p>This leaks nothing. A tenant subdomain <em>is</em> a public hostname —
 * {@code anna-foto.fotolio.de} serves a portfolio to anyone who asks — so
 * confirming that one is in use tells a caller what DNS already would.
 *
 * @param subdomain the normalized value that was checked, echoed back so a
 *                  client can discard a response that has been overtaken by
 *                  newer keystrokes
 * @param available true when a registration could claim it right now
 * @param reason    {@code INVALID}, {@code RESERVED} or {@code TAKEN}
 */
public record SubdomainAvailabilityResponse(
    String subdomain,
    boolean available,
    String reason
) {

    public static final String INVALID = "INVALID";
    public static final String RESERVED = "RESERVED";
    public static final String TAKEN = "TAKEN";

    public static SubdomainAvailabilityResponse available(String subdomain) {
        return new SubdomainAvailabilityResponse(subdomain, true, null);
    }

    public static SubdomainAvailabilityResponse unavailable(String subdomain, String reason) {
        return new SubdomainAvailabilityResponse(subdomain, false, reason);
    }
}
