package com.photographplatform.api.messaging.application;

import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.messaging.domain.StudioIdentity;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;

/**
 * Reads the studio's {@link StudioIdentity} at the moment a Customer message is
 * queued.
 *
 * <p>Through {@code tenant}'s service and {@link EntitlementService}, never the
 * tenant repository: {@code messaging} owns no tables and reads nobody's.
 */
@Service
public class StudioIdentityResolver {

    private final PublicTenantResolver tenants;
    private final EntitlementService entitlementService;
    private final String webBaseUrl;

    public StudioIdentityResolver(PublicTenantResolver tenants, EntitlementService entitlementService,
                                  @Value("${app.web.base-url:http://localhost:3000}") String webBaseUrl) {
        this.tenants = tenants;
        this.entitlementService = entitlementService;
        this.webBaseUrl = webBaseUrl;
    }

    public StudioIdentity resolve(UUID tenantId) {
        Tenant tenant = tenants.requireById(tenantId);
        boolean whiteLabel = entitlementService.forTenant(tenant).has(Capability.WHITE_LABEL_BRANDING);
        return StudioIdentity.resolve(
            tenant.customerFacingName(),
            tenant.getLegalEmail(),
            tenant.getOwnerEmail(),
            whiteLabel,
            whiteLabel && tenant.getLogoKey() != null ? logoUrl(tenant) : null,
            tenant.getBrandColor());
    }

    /*
     * The stable public route, not a presigned URL: a signature dies after 60
     * minutes and the Customer opens the email days later. The web app proxies
     * /api/*, so the address is on the domain the Customer already knows.
     */
    private String logoUrl(Tenant tenant) {
        return webBaseUrl + "/api/public/studios/"
            + UriUtils.encodePathSegment(tenant.getSubdomain(), StandardCharsets.UTF_8)
            + "/logo";
    }
}
