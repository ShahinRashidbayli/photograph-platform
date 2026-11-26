package com.photographplatform.api.branding.service;

import com.photographplatform.api.auth.service.AvatarUrlResolver;
import com.photographplatform.api.branding.dto.BrandingResponse;
import com.photographplatform.api.branding.dto.UpdateBrandingRequest;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The studio's own logo and colour on the pages its clients see.
 *
 * <p>Studio's {@code WHITE_LABEL_BRANDING} capability — the last row of the
 * pricing table that was sold and not built.
 *
 * <h2>What the capability gates, and what it does not</h2>
 * Setting a logo and a colour is gated: it is the feature being paid for.
 * <em>Reading</em> them is not, and cannot be — a client opening a gallery is
 * anonymous, has no plan of their own, and the studio's plan is not something
 * to disclose on a public page.
 *
 * <p>So the read path answers with whatever the tenant has stored plus a
 * {@code whiteLabel} flag saying whether the platform's name comes off. A
 * studio that sets a logo and then downgrades keeps its logo and gets the
 * "Powered by" line back, which is the honest outcome: they stop paying for the
 * part they stopped paying for, not for the part they uploaded.
 */
@Service
public class BrandingService {

    private final TenantRepository tenantRepository;
    private final EntitlementService entitlementService;
    private final AvatarUrlResolver urlResolver;
    private final PublicTenantResolver publicTenantResolver;

    public BrandingService(
        TenantRepository tenantRepository,
        EntitlementService entitlementService,
        AvatarUrlResolver urlResolver,
        PublicTenantResolver publicTenantResolver
    ) {
        this.tenantRepository = tenantRepository;
        this.entitlementService = entitlementService;
        this.urlResolver = urlResolver;
        this.publicTenantResolver = publicTenantResolver;
    }

    /** What a tenant's client-facing surfaces should wear. */
    @Transactional(readOnly = true)
    public BrandingResponse forTenant(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Studio not found"));
        return toResponse(tenant);
    }

    /**
     * A freshly signed URL for the studio's logo, for a link that has to
     * outlive any one signature.
     *
     * <p>Customer messages are opened days after they are sent, and a signed
     * URL dies after {@code app.r2.presigned-expiry-minutes}. The email points
     * at the stable public route instead, which lands here on every open.
     *
     * <p>Unlike {@link #forTenant}, this read <em>is</em> gated: the only
     * caller is the white-label email layout, and a logo outside that plan
     * has no reason to be served from a URL anyone can enumerate by
     * subdomain. A missing logo and a missing capability answer the same
     * 404, so the route says nothing about a studio's plan.
     *
     * @throws NotFoundException when there is no logo this route may serve
     */
    @Transactional(readOnly = true)
    public String logoUrlForSubdomain(String subdomain) {
        Tenant tenant = publicTenantResolver.requireBySubdomain(subdomain);
        if (!entitlementService.forTenant(tenant).has(Capability.WHITE_LABEL_BRANDING)) {
            throw new NotFoundException("Logo not found");
        }
        String url = urlResolver.resolve(tenant.getLogoKey());
        if (url == null) {
            throw new NotFoundException("Logo not found");
        }
        return url;
    }

    /**
     * Updates the logo and colour.
     *
     * @throws com.photographplatform.api.common.exception.PlanUpgradeRequiredException
     *         when the plan does not include white-label branding
     */
    @Transactional
    public BrandingResponse update(UUID tenantId, UpdateBrandingRequest request) {
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Studio not found"));
        entitlementService.requireCapability(tenant, Capability.WHITE_LABEL_BRANDING);
        entitlementService.requireWritable(tenant);

        // Absent leaves the field alone; empty clears it. Treating absent as
        // "clear" meant saving a colour deleted the logo, because the two are
        // saved by different controls — see UpdateBrandingRequest.
        if (request.logoKey() != null) {
            tenant.setLogoKey(blankToNull(request.logoKey()));
        }
        if (request.brandColor() != null) {
            tenant.setBrandColor(blankToNull(request.brandColor()));
        }
        tenantRepository.save(tenant);
        return toResponse(tenant);
    }

    private BrandingResponse toResponse(Tenant tenant) {
        return new BrandingResponse(
            // Re-signed on every read, never stored: these URLs expire.
            urlResolver.resolve(tenant.getLogoKey()),
            tenant.getBrandColor(),
            entitlementService.forTenant(tenant).has(Capability.WHITE_LABEL_BRANDING));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
