package com.photographplatform.api.lead.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record LeadResponse(
    UUID id,
    String name,
    String email,
    String phone,
    LocalDate eventDate,
    String eventType,
    String budgetRange,
    String message,
    String score,
    String status,
    OffsetDateTime createdAt
) {}
