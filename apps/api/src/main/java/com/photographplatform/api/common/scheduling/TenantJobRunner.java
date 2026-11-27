package com.photographplatform.api.common.scheduling;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.logging.LogFields;
import com.photographplatform.api.common.logging.MdcScope;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.util.function.ToIntFunction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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

    /**
     * Tenants held in memory at once. Small on purpose: the per-tenant work
     * below dominates the runtime by orders of magnitude, so there is nothing
     * to win by fetching more, and the point of the change is that this number
     * stays fixed however many tenants the platform has.
     */
    private static final int PAGE_SIZE = 100;

    /**
     * Oldest first, and <em>not</em> by id.
     *
     * <p>Paging is only coherent if the ordering is stable across the whole
     * sweep — a row that moves between pages is either visited twice or skipped
     * entirely. Tenant ids are {@code gen_random_uuid()}, so a tenant signing up
     * mid-sweep lands at a random position and pushes everything after it down
     * by one, skipping whichever tenant was on the page boundary. Ordered by
     * creation time, a new tenant can only ever append past the end, where at
     * worst it is picked up by tonight's sweep instead of tomorrow's. The id is
     * the tie-break, because {@code created_at} is not unique.
     */
    private static final Sort PAGE_ORDER = Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id"));

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
        int visited = 0;
        int processed = 0;
        int failed = 0;

        // Read with no tenant bound — `tenants` is one of the tables V11
        // deliberately left outside RLS, so this is the one query that can see
        // across tenants. It is also, for the same reason, the one query with
        // nothing to bound it: findAll() materialised every tenant on the
        // platform into the heap, three times a night (this runs once per
        // retention phase), to do work that only ever looks at one of them at a
        // time. A page at a time costs the same number of rows in total and a
        // fixed amount of memory.
        Page<Tenant> page;
        int pageNumber = 0;
        // Every line the work writes carries the job and the tenant, so a
        // nightly failure can be found by either without the work having to
        // say which it was.
        try (MdcScope jobScope = MdcScope.open().with(LogFields.JOB, jobName)) {
            do {
                page = tenantRepository.findAll(PageRequest.of(pageNumber, PAGE_SIZE, PAGE_ORDER));

                for (Tenant tenant : page.getContent()) {
                    visited++;
                    // Opened outside the try so the catch below still logs under it.
                    try (MdcScope tenantScope = MdcScope.open().with(LogFields.TENANT_ID, tenant.getId())) {
                        try {
                            TenantContext.setTenant(tenant.getId().toString());
                            Integer count = perTenantTransaction.execute(status -> work.applyAsInt(tenant));
                            processed += count == null ? 0 : count;
                        } catch (RuntimeException ex) {
                            failed++;
                            // Named by id (in the log context), never by subdomain:
                            // a solo photographer's subdomain is usually their name.
                            LOG.error("Job '{}' failed for this tenant; continuing with the next", jobName, ex);
                        } finally {
                            // Not optional. The scheduler's threads are pooled and reused
                            // across jobs, so a binding left behind here would silently
                            // become the next job's tenant — RLS would happily serve one
                            // tenant's rows to work intended for another. Clearing here
                            // also means the next page is fetched unbound, as it must be.
                            TenantContext.clear();
                        }
                    }
                }
                pageNumber++;
            } while (page.hasNext());
        }

        return new Result(visited, processed, failed);
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
