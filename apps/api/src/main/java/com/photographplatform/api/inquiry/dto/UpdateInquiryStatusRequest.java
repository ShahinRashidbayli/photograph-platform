package com.photographplatform.api.inquiry.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Payload for {@code PATCH /api/inquiries/{id}/status}. The photographer
 * triages a fresh inquiry to {@code ACCEPTED} (they'll follow up / convert it
 * to a booking) or {@code REJECTED}. {@code BOOKING_CREATED} is reserved for
 * the convert-to-booking flow and is never set through this route; the schema
 * CHECK constraint caps the column to
 * {@code PENDING | ACCEPTED | REJECTED | BOOKING_CREATED}.
 *
 * @param note the photographer's optional personal note to the Customer, sent
 *             with the decision as plain text; never stored on the inquiry
 */
public record UpdateInquiryStatusRequest(
    @NotBlank(message = "Status is required")
    String status,

    @Size(max = 1000, message = "A personal note is at most 1000 characters")
    String note
) {}
