package com.photographplatform.api.common.scheduling;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.util.List;
import java.util.function.ToIntFunction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Runs a unit of work once per tenant, with that tenant bound.
 *
 * <p>Background jobs cannot simply query tenant tables. Isolation is enforced
 * by Postgres RLS against {@code app.tenant_id}, which
 * {@code TenantRoutingDataSource} binds from {@link TenantContext} per
 * transaction — and the policies fail closed, so a job with no tenant bound
 * sees <em>zero rows</em> on every tenant-scoped table rather than all of
 * them. That is the safe direction, but it means a job that forgets to bind a
 * tenant silently does nothing at all, which is a bug that looks exactly like
 * "there was no work to do".
 *
 * <p>So the iteration lives here once, rather than in each job.
 */
@Component
public class TenantJobRunner {

    private static final Logger LOG = LoggerFactory.getLogger(TenantJobRunner.class);

    private final TenantRepository tenantRepository;
    private final TransactionTemplate perTenantTransaction;

    public TenantJobRunner(
        TenantRepository tenantRepository, PlatformTransactionManager transactionManager) {
        this.tenantRepository = tenantRepository;
        this.perTenantTransaction = new TransactionTemplate(transactionManager);
        // One transaction per tenant, not one for the whole sweep. A sweep-wide
        // transaction would hold a connection for its entire duration and would
        // roll back every tenant's work because one tenant failed.
        this.perTenantTransaction.setPropagationBehavior(
            TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Applies {@code work} to every tenant, returning the summed count.
     *
     * <p>A failure for one tenant is logged and skipped, never propagated: a
     * single tenant with corrupt data must not stop the job for everyone else,
     * and the next tick retries them anyway.
     *
     * @param work returns how many items it processed, for the job's log line
     */
    public Result forEachTenant(String jobName, ToIntFunction<Tenant> work) {
        // Read with no tenant bound — `tenants` is one of the tables V11
        // deliberately left outside RLS, so this is the one query that can see
        // across tenants.
        List<Tenant> tenants = tenantRepository.findAll();
        int processed = 0;
        int failed = 0;

        for (Tenant tenant : tenants) {
            try {
                TenantContext.setTenant(tenant.getId().toString());
                Integer count = perTenantTransaction.execute(status -> work.applyAsInt(tenant));
                processed += count == null ? 0 : count;
            } catch (RuntimeException ex) {
                failed++;
                LOG.error("Job '{}' failed for tenant {} ({}): {}",
                    jobName, tenant.getSubdomain(), tenant.getId(), ex.getMessage(), ex);
            } finally {
                // Not optional. The scheduler's threads are pooled and reused
                // across jobs, so a binding left behind here would silently
                // become the next job's tenant — RLS would happily serve one
                // tenant's rows to work intended for another.
                TenantContext.clear();
            }
        }

        return new Result(tenants.size(), processed, failed);
    }

    /**
     * @param tenants   how many tenants were visited
     * @param processed how many items the work reported handling
     * @param failed    how many tenants threw
     */
    public record Result(int tenants, int processed, int failed) {

        public boolean didWork() {
            return processed > 0 || failed > 0;
        }
    }
}
