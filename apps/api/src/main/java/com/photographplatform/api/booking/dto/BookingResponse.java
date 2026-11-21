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
     * What is still to come in on the quote: the quoted total less what was
     * paid, never below zero. Zero unless the booking is Billable, because
     * nothing is agreed on an enquiry and nothing is owed on a shoot that is
     * Not happening. Derived here so web keeps no Billable list of its own.
     */
    int openBalanceCents,
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
    OffsetDateTime createdAt
) {}
