package com.photographplatform.api.common.security;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.UnauthorizedException;
import java.util.UUID;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    @NonNull
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
    @Nullable
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
    @NonNull
    public static UUID requireCurrentTenantId() {
        UUID tenantId = currentTenantId();
        if (tenantId == null) {
            throw new UnauthorizedException("Authentication required");
        }
        return tenantId;
    }

    /**
     * Whether the current request's JWT carries the given role (e.g.
     * {@code "CUSTOMER"}, without the {@code ROLE_} prefix — see
     * {@link JwtAuthFilter}, which grants exactly one {@code ROLE_<role>}
     * authority per token). Used where an endpoint is reachable by more than
     * one role and must behave differently per role — e.g. scoping an
     * invoice/payment lookup to the caller's own booking only for CUSTOMER
     * callers, since PHOTOGRAPHER/ADMIN callers are already tenant-scoped by
     * RLS and may access any invoice in their tenant.
     */
    public static boolean currentUserHasRole(String role) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        String authority = "ROLE_" + role;
        return auth.getAuthorities().stream()
            .anyMatch(granted -> authority.equals(granted.getAuthority()));
    }
}
