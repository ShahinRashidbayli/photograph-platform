package com.photographplatform.api.common.security;

import com.photographplatform.api.common.exception.TooManyRequestsException;
import java.time.Duration;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

/**
 * A fixed-window counter, in one place.
 *
 * <h2>Why this is a component and not six copies of four lines</h2>
 * The same increment-then-expire-then-compare sequence was written out in
 * {@code AuthService}, {@code CustomerAuthService}, {@code PasswordResetService},
 * {@code EmailVerificationService}, {@code InquiryRequestService} and — in a
 * controller, reaching straight for {@code StringRedisTemplate} —
 * {@code LeadController}. Six copies is not just repetition: it is six places
 * that have to be found and fixed when the logic is wrong, and it was.
 *
 * <h2>The bug all six shared</h2>
 * {@code INCR} followed by a separate {@code EXPIRE} is two round-trips with a
 * gap between them. Lose the process (or the connection) in that gap and the
 * key exists with <em>no TTL</em>: the counter never resets and that email
 * address, IP or customer is rate-limited permanently, with nothing in the
 * product able to clear it.
 *
 * <p>The script below makes both a single atomic operation on the Redis side,
 * so the key cannot outlive its window.
 *
 * <h2>Failing open</h2>
 * If Redis is unreachable the call is allowed. That is the behaviour the six
 * copies already had (each guarded on {@code count != null}), and it is the
 * right trade for this product: rate limits here protect against spam and
 * credential stuffing, not against data loss, and a Redis outage that also
 * takes down login and public lead intake turns a degradation into an outage.
 * It is logged rather than silent, because "the limits are off" should be
 * findable.
 */
@Component
public class RateLimiter {

    private static final Logger LOG = LoggerFactory.getLogger(RateLimiter.class);

    /**
     * Increment, and set the expiry only on the first hit of a window.
     *
     * <p>{@code PEXPIRE} on {@code == 1} rather than on every call: refreshing
     * the TTL each time would turn a fixed window into a sliding one, and a
     * caller who keeps knocking would extend their own lockout indefinitely.
     */
    private static final RedisScript<Long> INCREMENT_IN_WINDOW = new DefaultRedisScript<>("""
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('PEXPIRE', KEYS[1], ARGV[1])
        end
        return count
        """, Long.class);

    private final StringRedisTemplate redis;

    public RateLimiter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * Counts this hit against {@code key} and rejects once {@code max} is
     * exceeded within {@code window}.
     *
     * @param key     the bucket — include what is being limited and by what,
     *                e.g. {@code "pwreset:req:email:" + email}
     * @param max     hits allowed per window; the {@code max + 1}th is refused
     * @param window  how long the bucket lives
     * @param message shown to the caller, so it should say what to do next
     * @throws TooManyRequestsException when the bucket is over its limit
     */
    public void check(String key, int max, Duration window, String message) {
        Long count = increment(key, window);
        if (count != null && count > max) {
            throw new TooManyRequestsException(message);
        }
    }

    /**
     * Counts a hit and reports whether the bucket is now over its limit,
     * without throwing.
     *
     * <p>For callers that must not reveal the limit — the magic-link and
     * password-reset request endpoints answer identically whether or not the
     * address exists, and a 429 would undo that by confirming the address is
     * worth limiting.
     *
     * @return true if this hit exceeded {@code max}
     */
    public boolean exceeds(String key, int max, Duration window) {
        Long count = increment(key, window);
        return count != null && count > max;
    }

    /**
     * Counts a hit and returns the running total for the window, or
     * {@code null} if Redis could not answer.
     *
     * <p>For the login lockout, which is not a plain limiter: it counts
     * failures and, on reaching the threshold, writes a separate lock key that
     * blocks even correct credentials for the lockout period. That needs the
     * count itself rather than a yes/no.
     */
    public Long hit(String key, Duration window) {
        return increment(key, window);
    }

    private Long increment(String key, Duration window) {
        try {
            return redis.execute(
                INCREMENT_IN_WINDOW, List.of(key), String.valueOf(window.toMillis()));
        } catch (RuntimeException ex) {
            // Fail open, loudly. See the class javadoc: the alternative is
            // that a Redis outage becomes a login outage.
            LOG.warn("Rate limit check failed for '{}' — allowing the request", key, ex);
            return null;
        }
    }
}
