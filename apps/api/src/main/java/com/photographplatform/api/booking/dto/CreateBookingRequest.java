package com.photographplatform.api.booking.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Payload for a photographer manually creating a booking. The new booking
 * always starts in {@code ENQUIRY} — the lifecycle is advanced afterwards via
 * {@code PATCH /api/bookings/{id}/status}, which enforces the state machine.
 *
 * <p>{@code clientId} is deprecated and the web app never sends it: it names
 * a row of the old {@code clients} table, which nothing writes (V41). The
 * client directory is derived from {@code clientEmail} instead, so every
 * booking puts its client there. Amount fields default to 0 when omitted.
 */
public record CreateBookingRequest(
    @NotBlank(message = "Client name is required")
    @Size(max = 200, message = "Client name must be at most 200 characters")
    String clientName,

    @NotBlank(message = "Client email is required")
    @Email(message = "Client email must be a valid email address")
    @Size(max = 320, message = "Client email must be at most 320 characters")
    String clientEmail,

    // A booking is always scheduled work, so a new one cannot start in the
    // past. Mirrors the same rule on CreateInquiryRequest.proposedDate.
    //
    // Deliberately NOT applied to UpdateBookingRequest: a shoot that has
    // already happened still needs editing — pricing it, correcting the
    // location, adding notes after the fact — and blocking that would make
    // every past booking permanently read-only.
    @NotNull(message = "Event date is required")
    @FutureOrPresent(message = "Event date cannot be in the past")
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

    String internalNotes,

    /**
     * Who will shoot it. Optional, and usually absent: a booking created from
     * an enquiry has no photographer decided yet, and the studio assigns it
     * later.
     */
    UUID assignedUserId,

    /**
     * Rooms and kit this shoot uses. Absent leaves them untouched; an empty
     * list clears them — the form always sends its whole selection, so those
     * have to mean different things or removing the last one is impossible.
     */
    List<UUID> resourceIds,

    /**
     * The language the Customer reads, and so every Customer message about
     * this booking. Absent means {@code de}, the studios' own language.
     */
    @Pattern(regexp = "de|en", message = "Language must be de or en")
    String language
) {}
