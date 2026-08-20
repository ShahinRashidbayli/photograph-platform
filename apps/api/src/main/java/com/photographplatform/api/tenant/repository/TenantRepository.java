package com.photographplatform.api.tenant.repository;

import com.photographplatform.api.tenant.domain.Tenant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    boolean existsBySubdomain(String subdomain);

    Optional<Tenant> findBySubdomain(String subdomain);

    /**
     * Resolves the tenant behind a Stripe connected account id. The {@code
     * account.updated} webhook arrives with nothing but an {@code acct_…} —
     * no tenant metadata and no JWT — so this is the only way back to the
     * owning tenant. Safe to call with no {@link
     * com.photographplatform.api.common.config.TenantContext} bound: {@code
     * tenants} is one of the tables V11 deliberately left outside RLS.
     */
    Optional<Tenant> findByStripeAccountId(String stripeAccountId);
}
