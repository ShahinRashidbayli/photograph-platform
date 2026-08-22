package com.photographplatform.api.common.security;

import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Stops writes from an account whose trial expired without a subscription, or
 * which was suspended (PRICING.md §7.7).
 *
 * <p>Enforced here rather than in each service for the reason PRICING.md §6
 * gives about gates generally — "a UI-only gate is a suggestion, not a limit" —
 * and because a per-service check is a rule that has to be remembered fifteen
 * times. One interceptor over every mutating method is a rule that cannot be
 * forgotten, with {@link AllowedWhenReadOnly} as the explicit escape hatch.
 *
 * <h2>What it deliberately does not block</h2>
 * <ul>
 *   <li><b>Reads.</b> Everything already created stays visible. The lock is
 *       meant to stop the account growing, not to hold its contents hostage.</li>
 *   <li><b>Anything a CUSTOMER does.</b> A client paying an invoice or
 *       downloading their gallery is not party to the photographer's billing.
 *       Blocking them would stop money coming *in* and would take a couple's
 *       wedding photos away over someone else's expired card.</li>
 *   <li><b>Public and unauthenticated endpoints.</b> A visitor's lead form on
 *       a lapsed photographer's page still submits — losing their enquiries is
 *       a punishment aimed at the wrong person, and those enquiries are the
 *       reason they might resubscribe.</li>
 * </ul>
 */
@Component
public class WriteAccessInterceptor implements HandlerInterceptor {

    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final TenantRepository tenantRepository;
    private final EntitlementService entitlementService;

    public WriteAccessInterceptor(
        TenantRepository tenantRepository, EntitlementService entitlementService) {
        this.tenantRepository = tenantRepository;
        this.entitlementService = entitlementService;
    }

    @Override
    public boolean preHandle(
        HttpServletRequest request, HttpServletResponse response, Object handler) {

        if (!MUTATING_METHODS.contains(request.getMethod())) {
            return true;
        }
        if (handler instanceof HandlerMethod method && isExempt(method)) {
            return true;
        }
        // Only a photographer's own writes are gated. A CUSTOMER session
        // belongs to the same tenant but is not the party being billed.
        if (!SecurityUtils.currentUserHasRole("PHOTOGRAPHER")
            && !SecurityUtils.currentUserHasRole("ADMIN")) {
            return true;
        }

        UUID tenantId = SecurityUtils.currentTenantId();
        if (tenantId == null) {
            // Unauthenticated or no tenant bound — Spring Security owns this
            // response; do not turn a 401 into a 402.
            return true;
        }

        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) {
            return true;
        }
        // Throws AccountReadOnlyException → 402 with code ACCOUNT_READ_ONLY.
        entitlementService.requireWritable(tenant);
        return true;
    }

    private boolean isExempt(HandlerMethod method) {
        return method.hasMethodAnnotation(AllowedWhenReadOnly.class)
            || method.getBeanType().isAnnotationPresent(AllowedWhenReadOnly.class);
    }
}
