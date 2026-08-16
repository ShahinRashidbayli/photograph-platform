package com.photographplatform.api.lead.domain;

import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.util.Normalize;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Legal lifecycle states of a lead and the allowed transitions between them —
 * the counterpart to {@link com.photographplatform.api.booking.domain.BookingStatus}
 * for the enquiry side of the funnel.
 *
 * <p>Why this exists: the lead lifecycle used to be raw {@code String}
 * comparisons spread across {@code LeadService} and {@code LeadController}
 * ({@code "REJECTED".equalsIgnoreCase(...)} in five places, a
 * {@code LEAD_STATUS_BOOKED} constant for a sixth). Each transition
 * re-derived the rules on its own, so "is this state terminal?" was answered
 * in three slightly different ways and adding a state meant finding every
 * literal. Booking already solved exactly this problem with an enum plus a
 * transition table; leads now share the shape.
 *
 * <p>{@code BOOKED} and {@code REJECTED} are terminal — re-opening means
 * creating a new lead, which keeps the conversion link to any booking the
 * lead spawned honest.
 */
public enum LeadStatus {
    NEW,
    REPLIED,
    BOOKED,
    REJECTED;

    private static final Map<LeadStatus, Set<LeadStatus>> ALLOWED = Map.of(
        NEW,      EnumSet.of(REPLIED, BOOKED, REJECTED),
        REPLIED,  EnumSet.of(BOOKED, REJECTED),
        BOOKED,   EnumSet.noneOf(LeadStatus.class),
        REJECTED, EnumSet.noneOf(LeadStatus.class)
    );

    /**
     * Parses a stored or caller-supplied status. Case-insensitive via {@link
     * Normalize}, which pins {@code Locale.ROOT} — see that class for why the
     * platform default is unsafe here.
     */
    public static LeadStatus parse(String value) {
        if (value == null) {
            throw new ConflictException("Lead status is required");
        }
        try {
            return LeadStatus.valueOf(Normalize.upper(value));
        } catch (IllegalArgumentException ex) {
            throw new ConflictException("Unknown lead status: " + value);
        }
    }

    /** Whether no further transition is legal from here. */
    public boolean isTerminal() {
        return ALLOWED.get(this).isEmpty();
    }

    public boolean canTransitionTo(LeadStatus next) {
        return ALLOWED.getOrDefault(this, EnumSet.noneOf(LeadStatus.class)).contains(next);
    }

    /**
     * Validate a transition, throwing {@link ConflictException} (HTTP 409) so
     * the global handler maps it consistently. Re-entering the current state
     * is <em>not</em> an error here: the lead endpoints treat it as an
     * idempotent no-op and return before calling this.
     */
    public void assertCanTransitionTo(LeadStatus next) {
        if (!canTransitionTo(next)) {
            throw new ConflictException(
                "Illegal lead status transition: " + name() + " -> " + next.name());
        }
    }
}
