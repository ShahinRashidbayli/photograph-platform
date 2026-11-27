package com.photographplatform.api.tenant.service;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves the photographer behind a public {@code {subdomain}} URL, and runs
 * work under that tenant.
 *
 * <p>The public endpoints — portfolio, gallery-by-token, lead intake — are
 * unauthenticated, so there is no JWT to carry a tenant and no {@link
 * TenantContext} bound by the auth filter. Each of them was resolving the
 * tenant, then the owner for a display name, then binding and clearing the
 * context itself: the same fifteen lines in three controllers, in the layer
 * least suited to owning them. Getting the {@code finally} wrong in any one of
 * them leaks a tenant binding onto a pooled thread, which is the failure this
 * consolidation is really about.
 */
@Service
public class PublicTenantResolver {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;

    public PublicTenantResolver(TenantRepository tenantRepository, UserRepository userRepository) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
    }

    /**
     * The photographer's public identity.
     *
     * @param displayName the owner's full name, falling back to the subdomain
     *                    — an incomplete profile renders a neutral public page
     *                    rather than 500-ing
     */
    public record PublicPhotographer(Tenant tenant, String displayName, String avatarUrl) {
    }

    @Transactional(readOnly = true)
    public Tenant requireBySubdomain(String subdomain) {
        return tenantRepository.findBySubdomain(subdomain)
            .orElseThrow(() -> new NotFoundException("Photographer not found: " + subdomain));
    }

    /**
     * The studio as its Customers see it, by id: for a Customer message, which
     * is queued from an event that carries the tenant id, not a subdomain.
     */
    @Transactional(readOnly = true)
    public Tenant requireById(UUID tenantId) {
        return tenantRepository.require(tenantId);
    }

    /**
     * Tenant plus the owner's display name and avatar. The display name lives
     * on the OWNER user, not the tenant, and {@code owner_email} is the only
     * link between them.
     */
    @Transactional(readOnly = true)
    public PublicPhotographer requirePhotographer(String subdomain) {
        Tenant tenant = requireBySubdomain(subdomain);
        // Asked of the staff row directly, now that ownership is recorded there
        // (V25). Matching tenants.owner_email against a user's address was the
        // older way to ask the same question, and it quietly stopped being
        // reliable the moment a studio could hold more than one photographer:
        // the address identifies the founder, not "the account that owns this",
        // and nothing kept the two in step after an email change.
        User owner = userRepository.findOwnerByTenantId(tenant.getId()).orElse(null);
        String displayName = owner != null && owner.getFullName() != null
            ? owner.getFullName()
            : tenant.getSubdomain();
        String avatarUrl = owner != null ? owner.getAvatarUrl() : null;
        return new PublicPhotographer(tenant, displayName, avatarUrl);
    }

    /**
     * Runs {@code action} with the tenant bound, then restores whatever was
     * bound before.
     *
     * <p>Restores rather than clears: on a public request there is nothing to
     * restore and the two are identical, but an unconditional clear turns this
     * into a trap the moment it is called from a path that already had a
     * tenant — RLS then fails closed on every later query in that request, and
     * the symptom is an empty result rather than an error.
     */
    public <T> T inTenantContext(Tenant tenant, Supplier<T> action) {
        String previous = TenantContext.getTenant();
        TenantContext.setTenant(tenant.getId().toString());
        try {
            return action.get();
        } finally {
            if (previous == null) {
                TenantContext.clear();
            } else {
                TenantContext.setTenant(previous);
            }
        }
    }
}
