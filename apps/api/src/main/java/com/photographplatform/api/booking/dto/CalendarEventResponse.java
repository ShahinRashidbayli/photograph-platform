package com.photographplatform.api.booking.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.UUID;

/**
 * FullCalendar-shaped projection of a booking. The frontend feeds an array of
 * these straight into FullCalendar's events option, so the field names are
 * non-negotiable: {@code id}, {@code title}, {@code start}, {@code end},
 * {@code extendedProps}.
 *
 * <p>{@code start} / {@code end} are ISO-8601 strings; we serialise the date or
 * date-time on the service side because a booking may or may not have an
 * {@code event_time}. {@code end} is omitted (not null-serialised) when we
 * don't have one, since FullCalendar treats a missing {@code end} as "all-day
 * for an indeterminate length" rather than misinterpreting an explicit null.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CalendarEventResponse(
    UUID id,
    String title,
    String start,
    String end,
    ExtendedProps extendedProps
) {

    public record ExtendedProps(
        String status,
        String clientEmail
    ) {}
}
