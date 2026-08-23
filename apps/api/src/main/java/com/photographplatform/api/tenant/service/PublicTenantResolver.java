package com.photographplatform.api.tenant.service;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
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
     * Tenant plus the owner's display name and avatar. The display name lives
     * on the OWNER user, not the tenant, and {@code owner_email} is the only
     * link between them.
     */
    @Transactional(readOnly = true)
    public PublicPhotographer requirePhotographer(String subdomain) {
        Tenant tenant = requireBySubdomain(subdomain);
        // Scoped to this tenant, which we already have. The global lookup this
        // replaces asked a question it had no business asking — "who anywhere
        // uses this address" — and threw the moment the answer was more than
        // one, taking down the photographer's entire public portfolio and every
        // gallery link on it.
        User owner = userRepository
            .findByTenantIdAndEmail(tenant.getId(), tenant.getOwnerEmail())
            .orElse(null);
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
