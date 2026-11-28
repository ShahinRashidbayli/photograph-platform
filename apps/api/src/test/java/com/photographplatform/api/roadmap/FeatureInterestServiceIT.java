package com.photographplatform.api.roadmap;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.roadmap.domain.RoadmapFeature;
import com.photographplatform.api.roadmap.service.FeatureInterestService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The roadmap vote against a real Postgres, because the bug it pins only
 * existed at commit: {@code save()} deferred the INSERT to the flush, outside
 * the {@code try} that was meant to swallow a duplicate, so a double click's
 * second PUT came back 409 and the toggle stayed on.
 */
class FeatureInterestServiceIT extends IntegrationTestBase {

    private static final RoadmapFeature FEATURE = RoadmapFeature.values()[0];
    private static final long SECOND_CLICK_WAIT_MS = 1_000;

    @Autowired private FeatureInterestService service;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private PlatformTransactionManager txManager;

    @Test
    void registeringTwiceInARowIsTheSameAsOnce() {
        UUID tenantId = createTenant();

        asTenant(tenantId, () -> {
            service.register(FEATURE);
            service.register(FEATURE);
            return null;
        });

        assertThat(asTenant(tenantId, service::listForCurrentTenant)).containsExactly(FEATURE.name());
    }

    /**
     * The double click, interleaved the way it failed rather than left to
     * thread timing (two racing threads overlapped in only some runs). The
     * first click's transaction is still open when the second registers and
     * commits; then the first commits. With {@code save()} the first click's
     * INSERT was sent only now, at commit, and hit the primary key — the 409.
     * Now its INSERT runs at once, so the second click waits on that row and
     * then does nothing.
     */
    @Test
    void aSecondClickCommittingFirstDoesNotFailTheFirst() throws Exception {
        UUID tenantId = createTenant();
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            AtomicReference<Future<?>> second = new AtomicReference<>();
            asTenant(tenantId, () -> new TransactionTemplate(txManager).execute(status -> {
                service.register(FEATURE);
                second.set(pool.submit(() -> asTenant(tenantId, () -> {
                    service.register(FEATURE);
                    return null;
                })));
                try {
                    second.get().get(SECOND_CLICK_WAIT_MS, TimeUnit.MILLISECONDS);
                } catch (TimeoutException blockedOnTheFirstClicksRow) {
                    // Expected once the INSERT is immediate: it holds the key
                    // until this transaction commits.
                } catch (InterruptedException | ExecutionException e) {
                    throw new IllegalStateException(e);
                }
                return null;
            }));
            second.get().get();
        } finally {
            pool.shutdownNow();
        }

        assertThat(asTenant(tenantId, service::listForCurrentTenant)).containsExactly(FEATURE.name());
    }

    @Test
    void withdrawingAfterRegisteringClearsTheVote() {
        UUID tenantId = createTenant();

        asTenant(tenantId, () -> {
            service.register(FEATURE);
            service.withdraw(FEATURE);
            service.withdraw(FEATURE);
            return null;
        });

        assertThat(asTenant(tenantId, service::listForCurrentTenant)).isEmpty();
    }

    private UUID createTenant() {
        return new TransactionTemplate(txManager).execute(status -> tenantRepository.save(
            new Tenant("roadmap-test-" + UUID.randomUUID(),
                "owner-" + UUID.randomUUID() + "@example.test")).getId());
    }

    private <T> T asTenant(UUID tenantId, Supplier<T> action) {
        TenantContext.setTenant(tenantId.toString());
        try {
            return action.get();
        } finally {
            TenantContext.clear();
        }
    }
}
