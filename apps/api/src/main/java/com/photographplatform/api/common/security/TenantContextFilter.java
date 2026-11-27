package com.photographplatform.api.common.security;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.logging.LogFields;
import com.photographplatform.api.common.logging.MdcScope;
import com.photographplatform.api.common.logging.RequestLoggingFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Defensive guard that runs after {@link JwtAuthFilter}.
 *
 * <ul>
 *   <li>Fail-closed: if the request is authenticated but no tenant is in
 *       context, reject with 401. Without this guard a malformed JWT (no
 *       {@code tenant_id} claim) or a misconfigured controller could let a
 *       request reach the database with a {@code null} {@link TenantContext} —
 *       RLS already fails that closed (the {@code app.tenant_id} GUC resolves
 *       to NULL, matching no rows), but this rejects earlier with a clearer
 *       signal than a silently empty result.</li>
 *   <li>Pushes {@code tenant_id} and {@code user_id} into MDC so log lines
 *       from this request are attributable to one tenant and one user during
 *       incident investigation, and leaves both on the request for the access
 *       line {@link RequestLoggingFilter} writes after this filter has
 *       cleared them.</li>
 * </ul>
 *
 * <p>This filter never <em>sets</em> the tenant — that is {@code JwtAuthFilter}'s
 * responsibility. It only validates and observes.
 */
@Component
public class TenantContextFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {
        String tenantId = TenantContext.getTenant();

        if (isAuthenticated() && (tenantId == null || tenantId.isBlank())) {
            // Authenticated but no tenant — refuse rather than running a query
            // against an indeterminate schema.
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Tenant context missing");
            return;
        }

        String tenant = tenantId == null || tenantId.isBlank() ? null : tenantId;
        String userId = isAuthenticated()
            ? SecurityContextHolder.getContext().getAuthentication().getName()
            : null;
        if (tenant != null) {
            request.setAttribute(RequestLoggingFilter.TENANT_ID_ATTRIBUTE, tenant);
        }
        if (userId != null) {
            request.setAttribute(RequestLoggingFilter.USER_ID_ATTRIBUTE, userId);
        }

        try (MdcScope scope = MdcScope.open()
                .with(LogFields.TENANT_ID, tenant)
                .with(LogFields.USER_ID, userId)) {
            chain.doFilter(request, response);
        }
    }

    private boolean isAuthenticated() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null
            && auth.isAuthenticated()
            && !(auth instanceof AnonymousAuthenticationToken);
    }
}
