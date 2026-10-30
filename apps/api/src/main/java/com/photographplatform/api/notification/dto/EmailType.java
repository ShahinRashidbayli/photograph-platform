package com.photographplatform.api.notification.dto;

/**
 * What an outbound email is, for logging and triage.
 *
 * <p>Logs about email delivery have to say enough to act on — which transport,
 * which kind of message, whose tenant — without saying who it was addressed to
 * or what it contained. The subject line is not a safe stand-in for the kind:
 * the sign-in code used to travel in one, and every transport logged the
 * subject, so the code went to the application log on each send (BUG-014).
 *
 * <p>The values are graded by what losing one costs, which is the ordering the
 * outbox follow-up in docs/BUGS.md will need:
 *
 * <ul>
 *   <li>{@link #LOGIN_CODE}, {@link #PASSWORD_RESET}, {@link #EMAIL_VERIFICATION},
 *       {@link #STAFF_INVITATION} — a lost one locks someone out until they ask
 *       again. Recoverable, and the user can see that it failed.</li>
 *   <li>{@link #CONTRACT_SIGNED}, {@link #GALLERY_EXPIRY} — a lost one has
 *       consequences nobody sees at the time: a countersignature nobody knows
 *       to expect, or a gallery deleted on schedule after the only warning
 *       failed to arrive.</li>
 *   <li>{@link #LEAD_NOTIFICATION}, {@link #INQUIRY_NOTIFICATION},
 *       {@link #LEAD_AUTO_REPLY}, {@link #INQUIRY_REPLY} — a lost one is a lost
 *       piece of business, silently.</li>
 * </ul>
 */
public enum EmailType {

    /** Six-digit customer sign-in code. */
    LOGIN_CODE,
    /** Address confirmation for a new studio account. */
    EMAIL_VERIFICATION,
    /** Password reset link. */
    PASSWORD_RESET,
    /** Invitation for a colleague to join a studio. */
    STAFF_INVITATION,

    /** Tells the photographer a contract came back signed. */
    CONTRACT_SIGNED,
    /** Warns a client their gallery is about to be deleted. */
    GALLERY_EXPIRY,

    /** Tells the photographer a new lead arrived. */
    LEAD_NOTIFICATION,
    /** Tells the photographer a new booking inquiry arrived. */
    INQUIRY_NOTIFICATION,
    /** Acknowledges a lead to the person who sent it. */
    LEAD_AUTO_REPLY,
    /** The photographer's answer to a customer's inquiry. */
    INQUIRY_REPLY
}
