package com.photographplatform.api.auth.service;

import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.security.TokenRevocationCheck;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Immediate revocation for access tokens, which are otherwise unrevocable.
 *
 * <h2>The problem</h2>
 * A JWT is self-contained: the filter checks the signature and the expiry and
 * asks nothing else. So {@code logout()} could invalidate refresh tokens and
 * still leave the access token working until it aged out — and the same was
 * true of a password reset, whose entire purpose is to eject someone who is
 * already inside the account.
 *
 * <p>Every token carries {@code iat}. Recording an instant per user and
 * refusing anything issued before it revokes every outstanding token for that
 * user in one write.
 *
 * <h2>Why Redis is in front of the database</h2>
 * This is consulted on <em>every authenticated request</em>, so a plain
 * {@code SELECT} would add a round-trip to the hot path — the same cost
 * {@code EmailVerificationInterceptor} explicitly declined to pay for its own
 * check.
 *
 * <p>The cache is <b>write-through, not expiry-based</b>, and that distinction
 * is the whole design. A short TTL would mean a revoked session stays usable
 * until the entry lapses, which is exactly the window being closed. Instead
 * {@link #revokeAllFor} writes Redis and the database together, so a revocation
 * is visible on the next request. The TTL below only bounds how long an
 * untouched entry lingers; it is longer than any token can live, so it never
 * decides anything.
 *
 * <h2>Failure behaviour: closed, via the database</h2>
 * Redis being unavailable falls back to the database rather than to "allow".
 * This is the opposite of {@code RateLimiter}, and deliberately so: a rate
 * limiter failing open costs some spam, whereas this failing open would let a
 * revoked session — possibly an attacker's — keep working for a day. The
 * fallback is a primary-key lookup, so a Redis outage degrades latency here
 * rather than correctness.
 */
@Component
public class SessionRevocation implements TokenRevocationCheck {

    private static final Logger LOG = LoggerFactory.getLogger(SessionRevocation.class);

    /** Comfortably longer than the refresh-token lifetime, so it never expires mid-session. */
    private static final Duration CACHE_TTL = Duration.ofDays(45);

    /** Cached marker for "this user has never revoked anything", so misses are not re-queried. */
    private static final String NEVER = "0";

    private final StringRedisTemplate redis;
    private final UserRepository userRepository;
    private final Clock clock;

    public SessionRevocation(
        StringRedisTemplate redis, UserRepository userRepository, Clock clock) {
        this.redis = redis;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    /**
     * Whether a token issued at {@code issuedAt} is still acceptable for this
     * user.
     *
     * @param issuedAt the JWT's {@code iat} claim
     */
    @Override
    public boolean isTokenStillValid(UUID userId, Instant issuedAt) {
        Instant revokedAt = revokedAtFor(userId);
        if (revokedAt == null) {
            return true;
        }
        // Not isAfter: a token minted in the same second as the revocation must
        // lose. Second-resolution `iat` means a token issued moments before a
        // logout can carry the identical timestamp, and letting it through
        // would leave the exact session being revoked alive.
        return issuedAt.isAfter(revokedAt);
    }

    /**
     * Revokes every access token this user currently holds.
     *
     * <p>Writes the database first: Redis is a cache and losing it must not
     * lose a revocation. The cache write follows so the next request sees the
     * change without waiting for a read-through.
     */
    @Transactional
    public void revokeAllFor(UUID userId) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        userRepository.findById(userId).ifPresent(user -> {
            user.setTokensValidAfter(now);
            userRepository.save(user);
        });
        cache(userId, now.toInstant());
        LOG.info("Revoked all access tokens for user {}", userId);
    }

    private Instant revokedAtFor(UUID userId) {
        String cached = read(userId);
        if (cached != null) {
            return NEVER.equals(cached) ? null : Instant.ofEpochMilli(Long.parseLong(cached));
        }

        OffsetDateTime stored = userRepository.findById(userId)
            .map(u -> u.getTokensValidAfter())
            .orElse(null);
        if (stored == null) {
            cacheNever(userId);
            return null;
        }
        cache(userId, stored.toInstant());
        return stored.toInstant();
    }

    private String read(UUID userId) {
        try {
            return redis.opsForValue().get(key(userId));
        } catch (RuntimeException ex) {
            // Fall through to the database — see the class javadoc on why this
            // must not become "allow".
            LOG.warn("Revocation cache unavailable for user {}; falling back to the database",
                userId, ex);
            return null;
        }
    }

    private void cache(UUID userId, Instant revokedAt) {
        write(userId, String.valueOf(revokedAt.toEpochMilli()));
    }

    private void cacheNever(UUID userId) {
        write(userId, NEVER);
    }

    private void write(UUID userId, String value) {
        try {
            redis.opsForValue().set(key(userId), value, CACHE_TTL);
        } catch (RuntimeException ex) {
            // The database already holds the truth; a cold cache only costs a
            // lookup on the next request.
            LOG.warn("Could not update the revocation cache for user {}", userId, ex);
        }
    }

    private String key(UUID userId) {
        return "session:revoked-before:" + userId;
    }
}
