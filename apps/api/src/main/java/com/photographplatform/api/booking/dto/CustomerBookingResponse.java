package com.photographplatform.api.booking.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Booking view returned to the customer who owns the booking.
 *
 * <p>Deliberately a separate type from {@link BookingResponse}: it omits
 * {@code internalNotes}, which is the photographer's private working text and
 * must never reach the client. Keeping it a distinct record (rather than
 * nulling a field on the shared response) means a future field added to
 * {@code BookingResponse} cannot silently leak into the customer payload.
 */
public record CustomerBookingResponse(
    UUID id,
    String clientName,
    String clientEmail,
    LocalDate eventDate,
    LocalTime eventTime,
    String eventType,
    String location,
    UUID packageId,
    Integer totalAmountCents,
    Integer depositAmountCents,
    String status,
    String paymentState,
    Integer amountPaidCents,
    /** Credit: what the Customer paid beyond what this booking's Live invoices ask for. */
    Integer creditCents,
    OffsetDateTime createdAt
) {}
