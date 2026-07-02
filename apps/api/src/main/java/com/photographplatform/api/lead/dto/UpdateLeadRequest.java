package com.photographplatform.api.lead.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Payload for {@code PATCH /api/leads/{id}}. Lets the photographer correct
 * mistakes captured at intake (typo in email, wrong event date, miscaptured
 * event type) without having to delete + re-enter the lead — which would
 * blow away the audit trail and the conversion link to any booking that
 * referenced this lead.
 *
 * <p>All editable fields are required because the form sends the full record
 * on save (PUT-style edit). {@code internalNotes} is not editable here — it
 * has its own purpose-built endpoint with its own audit row. {@code status},
 * {@code score} and component scores aren't editable either; status is
 * managed by the transition endpoints, and score is derived from the
 * editable inputs so it'll re-compute automatically.
 */
public record UpdateLeadRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 200, message = "Name must be at most 200 characters")
    String name,

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be a valid email address")
    @Size(max = 320, message = "Email must be at most 320 characters")
    String email,

    @Size(max = 30, message = "Phone must be at most 30 characters")
    String phone,

    @NotNull(message = "Event date is required")
    LocalDate eventDate,

    @NotBlank(message = "Event type is required")
    @Size(max = 50, message = "Event type must be at most 50 characters")
    String eventType,

    @NotBlank(message = "Budget range is required")
    @Size(max = 30, message = "Budget range must be at most 30 characters")
    String budgetRange,

    @Size(max = 4000, message = "Message must be at most 4000 characters")
    String message
) {}
