package com.photographplatform.api.tenant.controller;

import com.photographplatform.api.common.security.RateLimiter;
import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.tenant.dto.TenantLegalResponse;
import com.photographplatform.api.tenant.dto.UpdateTenantLegalRequest;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import com.photographplatform.api.tenant.service.TenantLegalService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A photographer's statutory disclosure details: read publicly by their own
 * Impressum / Datenschutz pages, edited privately from Settings.
 *
 * <p>The public route sits under {@code /api/public/**}, which
 * {@code SecurityConfig} already permits unauthenticated — correct here, since
 * an Impressum that required a login would defeat its own purpose.
 */
@RestController
@RequestMapping("/api")
public class TenantLegalController {

    /**
     * Generous enough that a visitor reading both legal pages, or a page
     * revalidating its ISR cache, never notices — and low enough that walking
     * the subdomain space to harvest addresses is not a single afternoon's
     * work. An Impressum is public, but "public" means readable by a visitor,
     * not bulk-collectable into a mailing list.
     */
    private static final int PUBLIC_READ_MAX_PER_WINDOW = 60;
    private static final Duration PUBLIC_READ_WINDOW = Duration.ofMinutes(10);

    private final TenantLegalService tenantLegalService;
    private final PublicTenantResolver publicTenantResolver;
    private final RateLimiter rateLimiter;

    public TenantLegalController(TenantLegalService tenantLegalService,
                                 PublicTenantResolver publicTenantResolver,
                                 RateLimiter rateLimiter) {
        this.tenantLegalService = tenantLegalService;
        this.publicTenantResolver = publicTenantResolver;
        this.rateLimiter = rateLimiter;
    }

    /** Feeds {@code /p/{subdomain}/impressum} and {@code /datenschutz}. */
    @GetMapping("/public/legal/{subdomain}")
    public ResponseEntity<TenantLegalResponse> getPublicLegal(
        @PathVariable String subdomain,
        HttpServletRequest httpRequest
    ) {
        // Limited per IP rather than per subdomain: the abuse worth stopping is
        // one client sweeping many photographers, not many visitors reading one.
        rateLimiter.check("legal:read:ip:" + ClientIp.from(httpRequest),
            PUBLIC_READ_MAX_PER_WINDOW, PUBLIC_READ_WINDOW,
            "Too many requests. Please try again shortly.");
        Tenant tenant = publicTenantResolver.requireBySubdomain(subdomain);
        return ResponseEntity.ok(
            publicTenantResolver.inTenantContext(tenant, () -> tenantLegalService.forTenant(tenant)));
    }

    @GetMapping("/tenant/legal")
    public ResponseEntity<TenantLegalResponse> getOwnLegal() {
        return ResponseEntity.ok(tenantLegalService.getOwn());
    }

    @PutMapping("/tenant/legal")
    public ResponseEntity<TenantLegalResponse> updateOwnLegal(
        @Valid @RequestBody UpdateTenantLegalRequest request,
        HttpServletRequest httpRequest
    ) {
        return ResponseEntity.ok(
            tenantLegalService.updateOwn(request, ClientIp.from(httpRequest)));
    }
}
