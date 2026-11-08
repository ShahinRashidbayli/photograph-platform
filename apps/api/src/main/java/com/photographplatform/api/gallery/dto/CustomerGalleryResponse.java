package com.photographplatform.api.gallery.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A gallery as its client sees it in the portal: enough to recognise it and
 * open it, nothing about how the studio runs it.
 *
 * <p>Its own record rather than {@link GalleryResponse} with fields nulled, for
 * the reason {@code CustomerBookingResponse} is: that one carries the view
 * count, the retention clock and the purge date — the studio's business — and a
 * field added to it later would otherwise reach the client silently.
 *
 * <p>The access token is returned on purpose. It is the capability the
 * photographer already shares with this client by link; the portal only saves
 * them from having to keep that email.
 */
public record CustomerGalleryResponse(
    UUID id,
    UUID bookingId,
    String eventType,
    LocalDate shootDate,
    long photoCount,
    boolean downloadEnabled,
    OffsetDateTime expiresAt,
    String accessToken,
    /** A thumbnail of the first photo, watermarked when the gallery is; null without storage. */
    String coverUrl
) {}
