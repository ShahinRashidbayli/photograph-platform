package com.photographplatform.api.inquiry.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Payload for {@code PATCH /api/inquiries/{id}/status}. The photographer
 * triages a fresh inquiry to {@code ACCEPTED} (they'll follow up / convert it
 * to a booking) or {@code REJECTED}. {@code BOOKING_CREATED} is reserved for
 * the convert-to-booking flow and is never set through this route; the schema
 * CHECK constraint caps the column to
 * {@code PENDING | ACCEPTED | REJECTED | BOOKING_CREATED}.
 */
public record UpdateInquiryStatusRequest(
    @NotBlank(message = "Status is required")
    String status
) {}
