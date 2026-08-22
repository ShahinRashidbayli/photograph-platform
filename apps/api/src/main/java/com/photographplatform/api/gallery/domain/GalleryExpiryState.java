package com.photographplatform.api.gallery.domain;

import java.util.Locale;

/**
 * Where a gallery sits on the path from live to deleted (ADR-001 §4.3).
 *
 * <p>Three states rather than a boolean, because ADR-001 refuses to let
 * deletion be a single irreversible step: "an irreversible destructive job
 * needs room for <em>our own</em> bugs — a bad query that expires the wrong
 * tenant must be recoverable."
 */
public enum GalleryExpiryState {

    /** Live and reachable by the client. */
    ACTIVE,

    /**
     * Past its window: access revoked, bytes still in object storage. This is
     * the recoverable state — a photographer who missed the warnings can still
     * extend and get the gallery back, and so can we if the job was wrong.
     */
    EXPIRED,

    /**
     * Bytes destroyed. The row survives as a tombstone so the client's link can
     * say "this gallery expired on 14.09.2026 — contact your photographer"
     * rather than 404ing, which reads as a broken link and generates a support
     * ticket for the photographer instead of an explanation.
     *
     * <p>ADR-001 §5 weighed the tombstone against leaking that the booking
     * existed. It leaks nothing in practice: the URL carries a 64-character
     * capability token, so anyone who can see the tombstone already held the
     * secret link.
     */
    PURGED;

    public static GalleryExpiryState from(String raw) {
        if (raw == null) {
            return ACTIVE;
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            // An unreadable state must never read as "safe to delete".
            return ACTIVE;
        }
    }
}
