package com.photographplatform.api.common.cache;

import java.time.Duration;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Remembers, for a short while, that a request gate was <em>satisfied</em>.
 *
 * <p>The gates in {@code common.security} run in {@code preHandle}, before any
 * {@code @Transactional} service method — so each one costs a full database
 * round trip of its own: borrow a connection from a pool of ten, issue the
 * {@code set_config('app.tenant_id', …)} that {@code TenantRoutingDataSource}
 * binds on every acquisition, run a one-row {@code SELECT}, release. That is
 * two round trips and a pooled connection to answer a question whose answer
 * changes perhaps once a month. A Redis {@code GET} answers it in one round
 * trip and holds no Postgres connection at all, which is the part that matters
 * — the pool is the scarce resource, not the query.
 *
 * <h2>Positive-only, and why that is the whole safety argument</h2>
 * Only a <em>satisfied</em> gate is ever recorded. A gate that refuses is never
 * cached, so the refusing path always re-reads the database. That asymmetry is
 * deliberate and it is what makes a stale entry survivable:
 *
 * <ul>
 *   <li><b>Refusal → permission</b> (the photographer pays, the address gets
 *       verified) takes effect <b>immediately</b>. The blocked state was never
 *       stored, so there is nothing to go stale. This is the direction a user
 *       is sitting and watching, and the direction where being wrong costs
 *       money.</li>
 *   <li><b>Permission → refusal</b> (a subscription lapses, a card fails) takes
 *       effect within the TTL below, or at once where the event is one we
 *       actually see — see {@link #forget}. A lapsed account keeping write
 *       access for another minute is a billing lag, not a security hole: the
 *       lock exists to stop an account growing, and a minute of growth is
 *       nothing anyone will ever notice.</li>
 * </ul>
 *
 * <p>It is therefore <em>not</em> a general-purpose cache and must never be
 * used for one. It is only sound for a check whose failure is not a security
 * boundary. An authorisation decision — who may read whose data — does not
 * belong here; those stay on the database, every request, forever.
 *
 * <h2>Redis being unavailable is not an error</h2>
 * Every operation swallows its exception. A miss and a failure are the same
 * answer to the caller — "I don't know, go and check" — so an unreachable
 * Redis degrades this to exactly the behaviour that existed before it: the
 * real check, on every request. That is the safe direction, and unlike
 * {@code RateLimiter} (which must decide whether to allow an unmeasured
 * request) there is no trade-off to weigh here.
 */
@Component
public class GateCache {

    private static final Logger LOG = LoggerFactory.getLogger(GateCache.class);

    /**
     * "This tenant was allowed to write." Keyed by tenant id, since the billing
     * lock is tenant-wide rather than per-user.
     */
    public static final String WRITABLE = "writable";

    /** "This user's address was verified." Keyed by user id. */
    public static final String EMAIL_VERIFIED = "verified";

    /** Marker value; only the key's presence carries meaning. */
    private static final String SATISFIED = "1";

    private final StringRedisTemplate redis;

    public GateCache(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * Whether {@code gate} was recorded as satisfied for {@code subject} and has
     * not yet expired. False on a miss <em>and</em> on any Redis failure, so a
     * caller can treat both as "not known" and fall through to the real check.
     */
    public boolean isSatisfied(String gate, UUID subject) {
        try {
            return redis.hasKey(key(gate, subject));
        } catch (RuntimeException ex) {
            LOG.debug("Gate cache unavailable for '{}' — falling through to the real check", gate, ex);
            return false;
        }
    }

    /** Records that {@code gate} passed for {@code subject}, for {@code ttl}. */
    public void remember(String gate, UUID subject, Duration ttl) {
        try {
            redis.opsForValue().set(key(gate, subject), SATISFIED, ttl);
        } catch (RuntimeException ex) {
            LOG.debug("Gate cache unavailable for '{}' — not remembering this pass", gate, ex);
        }
    }

    /**
     * Drops the record so the next request re-evaluates the gate.
     *
     * <p>Call this from the place that handles an event known to close a gate —
     * a subscription webhook, say. It is an optimisation, not a correctness
     * requirement: the TTL closes the gate on its own, and some closures (a
     * trial simply reaching its end date) have no event to hang this on, so the
     * TTL has to be the real mechanism regardless.
     */
    public void forget(String gate, UUID subject) {
        try {
            redis.delete(key(gate, subject));
        } catch (RuntimeException ex) {
            LOG.debug("Gate cache unavailable for '{}' — entry will lapse with its TTL", gate, ex);
        }
    }

    /**
     * {@link #forget}, deferred until the current transaction commits.
     *
     * <p>Use this — not {@code forget} — from a service that has just changed
     * the state the gate reads. Evicting inline would drop the entry while the
     * new row is still uncommitted, so a request arriving in that window reads
     * the <em>old</em> row and caches it again, for a fresh full TTL. The
     * eviction would have made the staleness last longer than doing nothing.
     *
     * <p>Outside a transaction there is nothing to wait for, so it evicts
     * immediately.
     */
    public void forgetAfterCommit(String gate, UUID subject) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            forget(gate, subject);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(
            new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    forget(gate, subject);
                }
            });
    }

    private static String key(String gate, UUID subject) {
        return "gate:" + gate + ":" + subject;
    }
}
