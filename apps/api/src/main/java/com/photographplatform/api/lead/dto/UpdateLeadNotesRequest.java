package com.photographplatform.api.lead.dto;

import jakarta.validation.constraints.Size;

/**
 * Payload for {@code PATCH /api/leads/{id}/notes}. {@code notes} is nullable
 * because clearing the field is a legitimate operation (photographer wants
 * to erase a stale note). The backend treats {@code null} and empty string
 * identically — both clear the stored value.
 *
 * <p>Capped at 4000 chars on the wire as a sanity check; the column itself
 * is unbounded TEXT but a 4KB note is plenty for an enquiry annotation, and
 * a much larger payload almost certainly means a client bug.
 */
public record UpdateLeadNotesRequest(
    @Size(max = 4000, message = "Notes must be at most 4000 characters")
    String notes
) {}
