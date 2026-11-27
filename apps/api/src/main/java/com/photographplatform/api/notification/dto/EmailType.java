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
 * <p>The values are graded by what losing one costs, and the grade is the
 * outbox priority ({@link #priority()}): the person who is waiting for a code
 * goes before the alert that can wait a minute.
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
 *
 * <p>The {@code CUSTOMER_…}, {@code CONTRACT_TO_SIGN} and {@code GALLERY_…}
 * values are Customer messages, composed only in {@code messaging}; they take
 * the same grades. A contract nobody is told to sign, or a gallery nobody is
 * told about, stalls work the studio thinks is done, so those go with the
 * second group; an acknowledgement or a decision is business, the third.
 */
public enum EmailType {

    /** Six-digit customer sign-in code. */
    LOGIN_CODE(1),
    /** Address confirmation for a new studio account. */
    EMAIL_VERIFICATION(1),
    /** Password reset link. */
    PASSWORD_RESET(1),
    /** Invitation for a colleague to join a studio. */
    STAFF_INVITATION(1),

    /** Tells the photographer a contract came back signed. */
    CONTRACT_SIGNED(3),
    /** Warns a client their gallery is about to be deleted. */
    GALLERY_EXPIRY(3),
    /** Tells a Customer a contract waits for their signature. */
    CONTRACT_TO_SIGN(3),
    /** Tells a Customer their gallery is ready to view. */
    GALLERY_READY(3),
    /** Warns a Customer their gallery is about to be deleted, in their language. */
    GALLERY_EXPIRING(3),

    /** Tells the photographer a new lead arrived. */
    LEAD_NOTIFICATION(5),
    /** Tells the photographer a new booking inquiry arrived. */
    INQUIRY_NOTIFICATION(5),
    /**
     * Acknowledges a lead to the person who sent it. Only rows queued before
     * {@link #CUSTOMER_ENQUIRY_RECEIVED} replaced it still carry it; goes with
     * {@code AutoReplyService} in the release after (#127).
     */
    @Deprecated(forRemoval = true)
    LEAD_AUTO_REPLY(5),
    /** The photographer's answer to a customer's inquiry. */
    INQUIRY_REPLY(5),
    /** Acknowledges a Customer's enquiry in the studio's name. */
    CUSTOMER_ENQUIRY_RECEIVED(5),
    /** Tells a Customer the studio accepted or declined their request. */
    CUSTOMER_REQUEST_DECISION(5);

    private final int priority;

    EmailType(int priority) {
        this.priority = priority;
    }

    /** Outbox priority; lower is sent first. Someone is waiting on the auth emails. */
    public int priority() {
        return priority;
    }
}
