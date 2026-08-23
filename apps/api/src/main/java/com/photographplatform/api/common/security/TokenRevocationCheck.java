package com.photographplatform.api.common.security;

import java.time.Instant;
import java.util.UUID;

/**
 * Asks whether an access token has been revoked since it was issued.
 *
 * <p>This interface exists to invert a dependency that would otherwise point
 * the wrong way. {@link JwtAuthFilter} has to consult revocation state on every
 * authenticated request, but that state belongs to the {@code auth} module —
 * and {@code common} depending on a feature module is exactly what
 * {@code ArchitectureTest.commonStaysCommon} forbids, for the reason it gives
 * there: {@code common} is what every feature may depend on, so depending back
 * turns it into a second home for business rules.
 *
 * <p>So {@code common} declares the question and {@code auth} answers it. The
 * filter is compiled against this interface and never names the implementation;
 * Spring supplies {@code auth.service.SessionRevocation} at runtime, and that
 * class is where the actual policy and its reasoning live.
 */
public interface TokenRevocationCheck {

    /**
     * Whether a token issued at {@code issuedAt} is still acceptable for this
     * user.
     *
     * <p>Implementations are on the hot path — every authenticated request —
     * and must fail <em>closed</em>: when the answer cannot be determined, the
     * token must be refused rather than allowed, because the session being
     * asked about may be the one someone is trying to eject.
     *
     * @param issuedAt the JWT's {@code iat} claim
     */
    boolean isTokenStillValid(UUID userId, Instant issuedAt);
}
