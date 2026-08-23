package com.photographplatform.api.common.security;

import com.photographplatform.api.common.exception.TooManyRequestsException;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The counting rules, in the one place that now owns them.
 *
 * <p>This logic used to be copy-pasted into six classes. Consolidating it is
 * only worth anything if the consolidated version is actually pinned down —
 * otherwise it is the same code in a nicer location.
 */
class RateLimiterTest {

    private static final Duration WINDOW = Duration.ofHours(1);

    private StringRedisTemplate redis;
    private RateLimiter limiter;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        limiter = new RateLimiter(redis);
    }

    @SuppressWarnings("unchecked")
    private void countReturns(Long count) {
        when(redis.execute(any(RedisScript.class), any(List.class), anyString()))
            .thenReturn(count);
    }

    @Test
    @DisplayName("a hit inside the limit is allowed")
    void allowsUpToTheLimit() {
        countReturns(3L);

        assertThatCode(() -> limiter.check("k", 3, WINDOW, "too many"))
            .doesNotThrowAnyException();
    }

    /**
     * The boundary is worth stating: {@code max} hits are allowed and the
     * {@code max + 1}th is refused. Every copy of this used {@code count > max},
     * and a consolidation that quietly became {@code >=} would tighten six
     * limits at once.
     */
    @Test
    @DisplayName("the hit after the limit is refused")
    void refusesTheHitAfterTheLimit() {
        countReturns(4L);

        assertThatThrownBy(() -> limiter.check("k", 3, WINDOW, "too many"))
            .isInstanceOf(TooManyRequestsException.class)
            .hasMessage("too many");
    }

    @Test
    @DisplayName("exceeds reports without throwing")
    void exceedsReportsInsteadOfThrowing() {
        countReturns(4L);
        assertThat(limiter.exceeds("k", 3, WINDOW)).isTrue();

        countReturns(1L);
        assertThat(limiter.exceeds("k", 3, WINDOW)).isFalse();
    }

    @Test
    @DisplayName("hit returns the running count for the lockout path")
    void hitReturnsTheCount() {
        countReturns(5L);

        assertThat(limiter.hit("login:fail:email:a@b.c", WINDOW)).isEqualTo(5L);
    }

    /**
     * Redis being down must not take authentication and public lead intake down
     * with it. Every copy of the old code did this implicitly by guarding on
     * {@code count != null}; here it is a stated decision with a log line
     * behind it.
     */
    @Test
    @SuppressWarnings("unchecked")
    @DisplayName("an unreachable Redis allows the request rather than blocking it")
    void failsOpenWhenRedisIsUnavailable() {
        when(redis.execute(any(RedisScript.class), any(List.class), anyString()))
            .thenThrow(new RedisConnectionFailureException("down"));

        assertThatCode(() -> limiter.check("k", 1, WINDOW, "too many"))
            .doesNotThrowAnyException();
        assertThat(limiter.exceeds("k", 1, WINDOW)).isFalse();
    }

    /**
     * A mocked template returns null for an unstubbed call, which must read as
     * "no answer" and not as "zero hits, definitely under the limit" — the
     * distinction matters because the integration suite relies on it to keep
     * limits out of the way.
     */
    @Test
    @DisplayName("a null answer is treated as unavailable, not as zero")
    void nullCountAllows() {
        countReturns(null);

        assertThatCode(() -> limiter.check("k", 0, WINDOW, "too many"))
            .doesNotThrowAnyException();
    }
}
