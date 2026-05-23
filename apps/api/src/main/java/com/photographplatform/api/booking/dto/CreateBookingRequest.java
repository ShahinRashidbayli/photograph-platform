package com.photographplatform.api.booking.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Payload for a photographer manually creating a booking. The new booking
 * always starts in {@code ENQUIRY} — the lifecycle is advanced afterwards via
 * {@code PATCH /api/bookings/{id}/status}, which enforces the state machine.
 *
 * <p>{@code clientId} is optional: a booking may be linked to an existing
 * {@code Client} directory entry, or stand alone (e.g. a fresh enquiry whose
 * client record does not exist yet). Amount fields default to 0 when omitted.
 */
public record CreateBookingRequest(
    @NotBlank(message = "Client name is required")
    @Size(max = 200, message = "Client name must be at most 200 characters")
    String clientName,

    @NotBlank(message = "Client email is required")
    @Email(message = "Client email must be a valid email address")
    @Size(max = 320, message = "Client email must be at most 320 characters")
    String clientEmail,

    @NotNull(message = "Event date is required")
    LocalDate eventDate,

    LocalTime eventTime,

    @Size(max = 50, message = "Event type must be at most 50 characters")
    String eventType,

    @Size(max = 300, message = "Location must be at most 300 characters")
    String location,

    UUID clientId,

    UUID packageId,

    @PositiveOrZero(message = "Total amount cannot be negative")
    Integer totalAmountCents,

    @PositiveOrZero(message = "Deposit amount cannot be negative")
    Integer depositAmountCents,

    String internalNotes
) {}
