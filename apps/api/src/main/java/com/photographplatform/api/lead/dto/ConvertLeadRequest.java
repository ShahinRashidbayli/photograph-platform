package com.photographplatform.api.lead.dto;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Optional overrides applied when converting a lead into a booking. Every
 * field is nullable: by default the booking inherits the lead's contact
 * details, event date and event type. The photographer typically supplies
 * the time, location and pricing during the call that closes the lead.
 */
public record ConvertLeadRequest(
    LocalTime eventTime,

    @Size(max = 300, message = "Location must be at most 300 characters")
    String location,

    UUID packageId,

    @PositiveOrZero(message = "Total amount cannot be negative")
    Integer totalAmountCents,

    @PositiveOrZero(message = "Deposit amount cannot be negative")
    Integer depositAmountCents,

    String internalNotes
) {}
