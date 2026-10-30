package com.photographplatform.api.common.cache;

import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The two properties that make this cache safe to put in front of a gate: it
 * never answers "yes" when it does not know, and an eviction never lands before
 * the write that caused it.
 */
class GateCacheTest {

    private static final UUID SUBJECT = UUID.randomUUID();
    private static final String KEY = "gate:writable:" + SUBJECT;

    private StringRedisTemplate redis;
    private ValueOperations<String, String> values;
    private GateCache cache;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        cache = new GateCache(redis);
    }

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void aRecordedPassIsReported() {
        when(redis.hasKey(KEY)).thenReturn(true);
        assertThat(cache.isSatisfied(GateCache.WRITABLE, SUBJECT)).isTrue();
    }

    @Test
    void anAbsentKeyIsNotAPass() {
        when(redis.hasKey(KEY)).thenReturn(false);
        assertThat(cache.isSatisfied(GateCache.WRITABLE, SUBJECT)).isFalse();
    }

    /**
     * The failure direction that matters. An unreachable Redis must degrade to
     * "go and check", never to "let them through" — otherwise an outage would
     * quietly disable the gate instead of merely slowing it down.
     */
    @Test
    void anUnreachableRedisReportsNoPassRatherThanThrowing() {
        when(redis.hasKey(anyString()))
            .thenThrow(new RedisConnectionFailureException("down"));

        assertThat(cache.isSatisfied(GateCache.WRITABLE, SUBJECT)).isFalse();
    }

    @Test
    void aFailedWriteIsSwallowedSoTheRequestStillSucceeds() {
        when(redis.opsForValue()).thenThrow(new RedisConnectionFailureException("down"));

        cache.remember(GateCache.WRITABLE, SUBJECT, Duration.ofMinutes(1));
        // No exception: the caller has already passed its real check, and
        // failing to memoise that is not a reason to fail their request.
    }

    // ── eviction ordering ───────────────────────────────────────────────

    @Test
    void withNoTransactionAnEvictionHappensImmediately() {
        cache.forgetAfterCommit(GateCache.WRITABLE, SUBJECT);
        verify(redis).delete(KEY);
    }

    /**
     * Inside a transaction the eviction must wait. Dropping the entry while the
     * new row is still uncommitted lets a concurrent request read the old row
     * and cache it again for a full fresh TTL — the eviction would extend the
     * staleness it was meant to end.
     */
    @Test
    void insideATransactionAnEvictionWaitsForTheCommit() {
        TransactionSynchronizationManager.initSynchronization();

        cache.forgetAfterCommit(GateCache.WRITABLE, SUBJECT);
        verify(redis, never()).delete(anyString());

        TransactionSynchronizationManager.getSynchronizations()
            .forEach(sync -> sync.afterCommit());
        verify(redis).delete(KEY);
    }
}
