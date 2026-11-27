package com.photographplatform.api.gallery.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Size;

/**
 * Optional payload for {@code POST /api/galleries/{id}/send}.
 *
 * @param personalNote the photographer's optional Personal note to the
 *                     Customer, sent with the gallery as plain text; never
 *                     stored on the gallery. {@code note} on the wire.
 */
public record SendGalleryRequest(
    @Size(max = 1000, message = "A personal note is at most 1000 characters")
    @JsonProperty("note") String personalNote
) {}
