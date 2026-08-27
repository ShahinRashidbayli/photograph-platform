package com.photographplatform.api.booking.domain;

import com.photographplatform.api.common.exception.ConflictException;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Legal lifecycle states of a booking and the allowed transitions between
 * them — the shoot's operational pipeline only, never payment. Payment
 * progress is a separate, derived concern (see {@link BookingPaymentState}):
 * it's computed from real {@code Invoice}/{@code Payment} rows, not stored
 * as a lifecycle state here. The two used to be conflated (a {@code
 * DEPOSIT_PAID}/{@code FULLY_PAID} pair of lifecycle states) — that meant a
 * booking's stage and its payment progress could never be inspected or
 * changed independently, and there was no way to represent "confirmed but
 * unpaid and now the event date has passed" or a postponed shoot at all.
 *
 * <p>The state machine is enforced in the service layer ({@code
 * BookingService}) so the database CHECK constraint cannot be the only line
 * of defence: invalid transitions return HTTP 409 (via {@link
 * ConflictException}) with a clear message, instead of bubbling up as a
 * generic constraint-violation 500.
 *
 * <p>{@code COMPLETED}, {@code DECLINED} and {@code CANCELLED} are terminal —
 * re-opening requires creating a new booking, which keeps the audit trail
 * honest. {@code POSTPONED} is not terminal: a postponed shoot returns to
 * {@code CONFIRMED} once a new date is agreed, or moves to {@code CANCELLED}
 * if it falls through entirely.
 */
public enum BookingStatus {
    ENQUIRY,
    CONFIRMED,
    POSTPONED,
    COMPLETED,
    DECLINED,
    CANCELLED;

    private static final Map<BookingStatus, Set<BookingStatus>> ALLOWED = Map.of(
        ENQUIRY,    EnumSet.of(CONFIRMED, DECLINED, CANCELLED),
        CONFIRMED,  EnumSet.of(COMPLETED, POSTPONED, CANCELLED),
        POSTPONED,  EnumSet.of(CONFIRMED, CANCELLED),
        COMPLETED,  EnumSet.of(CANCELLED),
        DECLINED,   EnumSet.noneOf(BookingStatus.class),
        CANCELLED,  EnumSet.noneOf(BookingStatus.class)
    );

    /**
     * Statuses a shoot in this state cannot clash with, because it is not
     * happening. Named here rather than spelled as string literals inside two
     * separate conflict queries, which is where it lived and where the two
     * could quietly drift apart.
     */
    public static final Set<BookingStatus> NOT_HAPPENING = EnumSet.of(CANCELLED, DECLINED);

    public static BookingStatus parse(String value) {
        if (value == null) {
            throw new ConflictException("Booking status is required");
        }
        try {
            // Locale.ROOT, not the JVM default: plain toUpperCase() uses the
            // platform locale, and under Turkish locale rules lowercase 'i'
            // upper-cases to 'İ' (dotted, U+0130) rather than ASCII 'I' — so
            // "enquiry" becomes "ENQUİRY", which never matches the ENQUIRY
            // constant and every case-insensitive parse fails on that host.
            return BookingStatus.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ConflictException("Unknown booking status: " + value);
        }
    }

    /**
     * States where the shoot is over or called off, and editing its facts —
     * date, price, location — no longer describes anything that will happen.
     * {@code BookingService#updateBooking} refuses these, the way {@code
     * LeadService#updateLead} refuses a terminal lead.
     *
     * <p>Deliberately its own set rather than "has no legal transition left":
     * this enum's javadoc calls {@code COMPLETED} terminal but {@link #ALLOWED}
     * still permits {@code COMPLETED -> CANCELLED}, so the two disagree about
     * what terminal means. Editing a completed shoot is wrong either way — it
     * has been delivered and very likely invoiced — so the edit guard says what
     * it means directly instead of inheriting that ambiguity. Resolving the
     * disagreement itself is a change to the state machine, not to this guard.
     */
    public boolean isClosedForEdits() {
        return this == COMPLETED || this == DECLINED || this == CANCELLED;
    }

    public boolean canTransitionTo(BookingStatus next) {
        return ALLOWED.getOrDefault(this, EnumSet.noneOf(BookingStatus.class)).contains(next);
    }

    /**
     * Validate a transition. Throws {@link ConflictException} (HTTP 409) on
     * illegal transitions so the global exception handler maps it consistently.
     */
    public void assertCanTransitionTo(BookingStatus next) {
        if (this == next) {
            throw new ConflictException("Booking is already in status " + name());
        }
        if (!canTransitionTo(next)) {
            throw new ConflictException(
                "Illegal booking status transition: " + name() + " -> " + next.name()
            );
        }
    }
}
