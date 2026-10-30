package com.photographplatform.api.auth.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A seat that has been offered but not yet taken.
 *
 * <p>Carries no token — not even the hash. The plaintext exists only in the
 * email that delivered it, and returning the hash would let anyone who can read
 * this list mount an offline search for the token that matches it.
 *
 * @param status one of {@code PENDING}, {@code ACCEPTED}, {@code REVOKED},
 *               {@code EXPIRED} — computed server-side so the client is not
 *               left comparing timestamps to work out what it is looking at
 */
public record TeamInvitationResponse(
    UUID id,
    String email,
    String status,
    OffsetDateTime expiresAt,
    OffsetDateTime createdAt
) {
}
