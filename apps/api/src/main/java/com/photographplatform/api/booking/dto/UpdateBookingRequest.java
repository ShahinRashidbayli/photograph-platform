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
 * Payload for a photographer editing an existing booking's details.
 *
 * <p>Covers the operational and pricing fields — crucially it is the only way
 * to set a price on a booking created from an accepted inquiry, which starts at
 * {@code 0/0} with no amounts. It deliberately does <em>not</em> carry the
 * status: lifecycle changes go through {@code PATCH /api/bookings/{id}/status}
 * so the state machine stays the single place that validates transitions.
 *
 * <p>Semantics are replace-style (like the create payload): the required
 * identity/date fields are always sent, and the amount fields fall back to the
 * linked package price or 0 when omitted — same rule as {@code CreateBooking}.
 */
public record UpdateBookingRequest(
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

    UUID packageId,

    @PositiveOrZero(message = "Total amount cannot be negative")
    Integer totalAmountCents,

    @PositiveOrZero(message = "Deposit amount cannot be negative")
    Integer depositAmountCents,

    String internalNotes
) {}
