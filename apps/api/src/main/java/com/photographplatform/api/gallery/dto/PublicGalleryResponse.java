package com.photographplatform.api.gallery.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * The client-facing gallery, served by access token with no authentication.
 * Deliberately narrow: it exposes only what the recipient needs to view and
 * download their photos — the photographer's display name, the shoot context,
 * the download flag and the photos themselves. No booking id, client email,
 * view count or other tenant PII crosses this boundary.
 *
 * <p>Also serves the tombstone an expired gallery leaves behind. ADR-001 §5
 * left "tombstone or plain 404?" open; a tombstone is the answer because the
 * URL carries a 64-character capability token, so anyone who can see it
 * already held the secret link and nothing is leaked by explaining what
 * happened. A bare 404 reads as a broken link and turns into a support ticket
 * for the photographer instead of "ask them to extend it".
 *
 * @param expired  true when the window has passed; {@code photos} is then
 *                 empty and the client is shown the date instead
 */
public record PublicGalleryResponse(
    String photographerName,
    String bookingName,
    String eventType,
    LocalDate shootDate,
    boolean downloadEnabled,
    boolean watermarkEnabled,
    OffsetDateTime expiresAt,
    boolean expired,
    List<DeliveryPhotoResponse> photos
) {

    /** The tombstone: enough context to explain itself, and no photos. */
    public static PublicGalleryResponse expired(
        String photographerName, String bookingName, String eventType,
        LocalDate shootDate, OffsetDateTime expiresAt) {
        return new PublicGalleryResponse(
            photographerName, bookingName, eventType, shootDate,
            false, false, expiresAt, true, List.of());
    }
}
