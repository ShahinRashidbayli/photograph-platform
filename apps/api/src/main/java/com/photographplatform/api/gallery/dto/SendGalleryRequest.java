package com.photographplatform.api.gallery.dto;

import jakarta.validation.constraints.Size;

/**
 * Optional payload for {@code POST /api/galleries/{id}/send}.
 *
 * @param note the photographer's optional personal note to the Customer, sent
 *             with the gallery as plain text; never stored on the gallery
 */
public record SendGalleryRequest(
    @Size(max = 1000, message = "A personal note is at most 1000 characters")
    String note
) {}
