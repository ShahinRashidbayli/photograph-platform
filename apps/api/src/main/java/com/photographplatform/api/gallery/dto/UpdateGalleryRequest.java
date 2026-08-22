package com.photographplatform.api.gallery.dto;

/**
 * Partial update of a gallery's delivery settings. Every field is optional; a
 * null leaves that setting unchanged.
 *
 * <p>{@code expiresAt} used to live here, which meant the same PATCH that
 * toggles downloads could set any retention window the browser asked for.
 * Extending is now a separate operation ({@code POST /api/galleries/{id}/extend})
 * that grants exactly one plan-sized window and records that it happened —
 * ADR-001 §4.2 wants an extend the photographer can actually use, not an
 * arbitrary date field.
 */
public record UpdateGalleryRequest(
    Boolean downloadEnabled,
    Boolean watermarkEnabled
) {}
