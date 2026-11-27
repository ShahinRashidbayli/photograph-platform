package com.photographplatform.api.booking.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record BookingResponse(
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
    /** Derived from real Invoice/Payment rows by invoice's Settlement. Never stored. */
    String paymentState,
    Integer amountPaidCents,
    /**
     * Credit: what was paid for this booking beyond what its Live invoices ask
     * for, such as a payment on an invoice Storniert without a replacement.
     * The studio is holding it. Settlement's, like {@code paymentState}.
     */
    Integer creditCents,
    /**
     * Uncollected: what the quote has still to bring in, from {@code
     * Booking#uncollectedCents}. Sent so web keeps no Billable list of its own.
     */
    int uncollectedCents,
    String internalNotes,
    /**
     * The photographer shooting this, or null while nobody has been assigned.
     * The name comes with it so a list does not have to resolve every id
     * against the team separately.
     */
    UUID assignedUserId,
    String assignedUserName,
    /**
     * Rooms and kit this shoot holds. Sent so the edit form can show the
     * existing selection — without it, opening a booking and saving would
     * silently drop every resource it had.
     */
    List<UUID> resourceIds,
    /** The Customer's language as its ISO 639-1 code, {@code de} or {@code en}. */
    String language,
    OffsetDateTime createdAt
) {}
