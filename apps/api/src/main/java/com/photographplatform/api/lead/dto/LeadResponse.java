package com.photographplatform.api.lead.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Component scores (0–100) are computed on read from the lead's own fields,
 * not persisted. The rollup {@code score} (HIGH/MED/LOW) IS persisted on the
 * Lead row, but breaking it down keeps a single source of truth for the
 * scoring algorithm — if it evolves, every existing lead's breakdown reflects
 * the new logic without a backfill migration. Trade-off: changing the
 * algorithm silently rescores history; accepted for MVP since scoring is
 * purely advisory.
 */
public record LeadResponse(
    UUID id,
    String name,
    String email,
    String phone,
    LocalDate eventDate,
    String eventType,
    String budgetRange,
    String message,
    String internalNotes,
    String score,
    Integer budgetScore,
    Integer typeScore,
    Integer timeScore,
    String status,
    String source,
    String igMessageId,
    String igUsername,
    OffsetDateTime createdAt
) {}
