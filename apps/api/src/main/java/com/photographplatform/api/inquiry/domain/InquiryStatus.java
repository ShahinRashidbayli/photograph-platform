package com.photographplatform.api.inquiry.domain;

import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.util.Normalize;

/**
 * The states a customer inquiry can be stored in.
 *
 * <p>Written down once, because they were string literals in six places across
 * {@code InquiryRequestService} and the entity's field initialiser. The
 * immediate cost was the inbox filter: {@code ?status=PENDINGG} reached the
 * repository unchecked and answered an empty list, which reads exactly like
 * "nothing is waiting for you".
 *
 * <p>Note the asymmetry between what the API accepts and what is stored:
 * {@code PATCH .../status} takes {@code ACCEPTED} or {@code REJECTED} as an
 * <em>action</em>, and accepting stores {@link #BOOKING_CREATED} — the inquiry
 * is not "accepted", it has become a booking, and the stored state says which.
 * See {@link #parseTarget}.
 *
 * <p>Stored as text rather than {@code @Enumerated}, matching {@code
 * LeadStatus} and {@code Payment}/{@code Invoice}: the column and its derived
 * queries stay as they are, and the enum is the API.
 */
public enum InquiryStatus {
    /** Submitted, not yet triaged. The only state a transition may start from. */
    PENDING,

    /** Accepted — a booking was created from it. Terminal. */
    BOOKING_CREATED,

    /** Declined by the photographer. Terminal. */
    REJECTED;

    /** Case-insensitive, {@code Locale.ROOT}-pinned — see {@link Normalize}. */
    public static InquiryStatus parse(String value) {
        if (value == null) {
            throw new ConflictException("Inquiry status is required");
        }
        try {
            return InquiryStatus.valueOf(Normalize.upper(value));
        } catch (IllegalArgumentException ex) {
            throw new ConflictException("Unknown inquiry status: " + value);
        }
    }

    /**
     * Resolves what the triage endpoint was asked to do into the state to
     * store. {@code ACCEPTED} is an action with no matching stored state; it
     * resolves to {@link #BOOKING_CREATED}. {@code PENDING} is not a legal
     * target — triage only moves forwards.
     */
    public static InquiryStatus parseTarget(String value) {
        String target = value == null ? "" : Normalize.upper(value);
        if ("ACCEPTED".equals(target)) {
            return BOOKING_CREATED;
        }
        if (REJECTED.name().equals(target)) {
            return REJECTED;
        }
        throw new ConflictException("Unsupported status transition: " + value);
    }

    public boolean isTerminal() {
        return this != PENDING;
    }
}
