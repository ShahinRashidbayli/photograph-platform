package com.photographplatform.api.booking.dto;

import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Bookings the same photographer already has on the same day.
 *
 * <p>A warning, never a refusal. A photographer takes two shoots in one day
 * routinely — a morning portrait and an afternoon wedding — and sometimes takes
 * an overlapping one on purpose, because one is provisional or an assistant is
 * covering it. Refusing the save would make the product wrong more often than
 * the double-booking it prevented.
 *
 * <p>Scoped to the day rather than to overlapping hours, because the hours are
 * not reliably known: `event_time` is null on a fifth of bookings and duration
 * only exists when a package was chosen. Computing an overlap from a default
 * duration would invent precision the data does not have and then refuse or
 * permit a booking on the strength of it. The day is a fact; the caller sees
 * the times that are known and decides.
 */
public record BookingConflictResponse(
    List<Conflict> conflicts
) {
    /**
     * @param eventTime null when the existing booking has no time set — the
     *                  clash may be real or may not, and the client says so
     *                  rather than guessing
     */
    public record Conflict(
        UUID id,
        String clientName,
        LocalTime eventTime,
        String status
    ) {
    }
}
