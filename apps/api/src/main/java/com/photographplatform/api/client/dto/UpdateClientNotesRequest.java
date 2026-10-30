package com.photographplatform.api.client.dto;

import jakarta.validation.constraints.Size;

/**
 * Payload for {@code PATCH /api/clients/{id}/notes}. Notes are free-form and
 * optional — a null or blank body clears them. Capped to keep a runaway paste
 * out of the column.
 */
public record UpdateClientNotesRequest(
    @Size(max = 5000, message = "Notes must be 5000 characters or fewer")
    String notes
) {}
