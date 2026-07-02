package com.photographplatform.api.common.security;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.UnauthorizedException;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static UUID requireCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || auth.getPrincipal() == null) {
            throw new UnauthorizedException("Authentication required");
        }

        try {
            return UUID.fromString(auth.getPrincipal().toString());
        } catch (IllegalArgumentException ex) {
            throw new UnauthorizedException("Authentication required");
        }
    }

    /**
     * The current request's tenant id, or {@code null} if none is bound.
     *
     * <p>{@link JwtAuthFilter} extracts the {@code tenant_id} JWT claim and pins
     * it on {@link TenantContext} for the request, so authenticated handlers can
     * read it here without a database round-trip. Returns {@code null} (rather
     * than throwing) so best-effort audit logging still succeeds on the rare
     * path where no tenant is bound.
     */
    public static UUID currentTenantId() {
        String tenantId = TenantContext.getTenant();
        if (tenantId == null || tenantId.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(tenantId);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    /**
     * Like {@link #currentTenantId()} but throws {@link UnauthorizedException}
     * when no tenant is bound — use it where the tenant id is a query filter
     * (isolation boundary) rather than optional audit metadata.
     */
    public static UUID requireCurrentTenantId() {
        UUID tenantId = currentTenantId();
        if (tenantId == null) {
            throw new UnauthorizedException("Authentication required");
        }
        return tenantId;
    }
}
