package com.photographplatform.api.inquiry.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One inquiry as rendered to both sides of the flow.
 *
 * <p>Shared deliberately: every field here is already known to both parties —
 * the customer wrote the request, and it was addressed to this photographer.
 * There is no photographer-private field on an inquiry (the {@code Lead}
 * equivalent, {@code internalNotes}, has no counterpart here), so no
 * customer-safe projection is needed. If one is ever added, split this record
 * before exposing it.
 */
public record InquiryRequestResponse(
    UUID id,
    String customerName,
    String customerEmail,
    String eventType,
    String budgetRange,
    LocalDate proposedDate,
    String location,
    String message,
    String score,
    String status,
    String source,
    /** The Customer's language as its ISO 639-1 code, {@code de} or {@code en}. */
    String language,
    OffsetDateTime createdAt
) {}
