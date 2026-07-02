package com.photographplatform.api.lead.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Payload for {@code PATCH /api/leads/{id}/status}. Only allowed terminal
 * status the photographer can set today is {@code REJECTED} (and that's the
 * only transition the controller route accepts); the schema CHECK constraint
 * caps the field to {@code NEW | REPLIED | BOOKED | REJECTED}, so a typo
 * would 400 at the DB layer too.
 */
public record UpdateLeadStatusRequest(
    @NotBlank(message = "Status is required")
    String status
) {}
