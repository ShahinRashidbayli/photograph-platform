package com.photographplatform.api.booking.domain;

import com.photographplatform.api.common.exception.ConflictException;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Legal lifecycle states of a booking and the allowed transitions between them.
 *
 * <p>The state machine is enforced in the service layer ({@code BookingService})
 * so the database CHECK constraint cannot be the only line of defence: invalid
 * transitions return HTTP 409 (via {@link ConflictException}) with a clear
 * message, instead of bubbling up as a generic constraint-violation 500.
 *
 * <p>Cancellation is allowed from any non-terminal state. Once a booking is
 * {@code COMPLETED} or {@code CANCELLED} it is terminal — re-opening requires
 * creating a new booking, which keeps the audit trail honest.
 */
public enum BookingStatus {
    ENQUIRY,
    CONFIRMED,
    DEPOSIT_PAID,
    FULLY_PAID,
    COMPLETED,
    CANCELLED;

    private static final Map<BookingStatus, Set<BookingStatus>> ALLOWED = Map.of(
        ENQUIRY,      EnumSet.of(CONFIRMED, CANCELLED),
        CONFIRMED,    EnumSet.of(DEPOSIT_PAID, FULLY_PAID, CANCELLED),
        DEPOSIT_PAID, EnumSet.of(FULLY_PAID, CANCELLED),
        FULLY_PAID,   EnumSet.of(COMPLETED, CANCELLED),
        COMPLETED,    EnumSet.noneOf(BookingStatus.class),
        CANCELLED,    EnumSet.noneOf(BookingStatus.class)
    );

    public static BookingStatus parse(String value) {
        if (value == null) {
            throw new ConflictException("Booking status is required");
        }
        try {
            return BookingStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ConflictException("Unknown booking status: " + value);
        }
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
