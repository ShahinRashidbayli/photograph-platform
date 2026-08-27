package com.photographplatform.api.booking.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
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
    /** Derived from real Invoice/Payment rows — see BookingPaymentStateResolver. Never stored. */
    String paymentState,
    Integer amountPaidCents,
    String internalNotes,
    /**
     * The photographer shooting this, or null while nobody has been assigned.
     * The name comes with it so a list does not have to resolve every id
     * against the team separately.
     */
    UUID assignedUserId,
    String assignedUserName,
    OffsetDateTime createdAt
) {}
