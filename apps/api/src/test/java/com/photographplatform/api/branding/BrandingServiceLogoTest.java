package com.photographplatform.api.branding;

import com.photographplatform.api.auth.service.AvatarUrlResolver;
import com.photographplatform.api.branding.service.BrandingService;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.domain.Entitlements;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import java.util.EnumSet;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The stable logo route behind Customer messages: which studios get a signed
 * URL, and which get a 404.
 */
class BrandingServiceLogoTest {

    private final EntitlementService entitlementService = mock(EntitlementService.class);
    private final AvatarUrlResolver urlResolver = mock(AvatarUrlResolver.class);
    private final PublicTenantResolver tenantResolver = mock(PublicTenantResolver.class);
    private final BrandingService service = new BrandingService(
        mock(TenantRepository.class), entitlementService, urlResolver, tenantResolver);

    private Tenant studio(String logoKey, Plan plan, Capability... capabilities) {
        Tenant tenant = new Tenant("anna-foto", "anna@example.test");
        tenant.setLogoKey(logoKey);
        when(tenantResolver.requireBySubdomain("anna-foto")).thenReturn(tenant);
        EnumSet<Capability> granted = EnumSet.noneOf(Capability.class);
        granted.addAll(List.of(capabilities));
        when(entitlementService.forTenant(tenant))
            .thenReturn(new Entitlements(plan, granted, 60, 1, 200, 0L));
        return tenant;
    }

    @Test
    void whiteLabelStudioWithALogoGetsAFreshlySignedUrl() {
        studio("tenants/anna/logo.png", Plan.STUDIO, Capability.WHITE_LABEL_BRANDING);
        when(urlResolver.resolve("tenants/anna/logo.png")).thenReturn("https://r2.test/logo.png?sig=1");

        assertThat(service.logoUrlForSubdomain("anna-foto")).isEqualTo("https://r2.test/logo.png?sig=1");
    }

    @Test
    void studioWithoutALogoIsNotFound() {
        studio(null, Plan.STUDIO, Capability.WHITE_LABEL_BRANDING);
        when(urlResolver.resolve(null)).thenReturn(null);

        assertThatThrownBy(() -> service.logoUrlForSubdomain("anna-foto"))
            .isInstanceOf(NotFoundException.class);
    }

    /**
     * A studio that uploaded a logo and then downgraded keeps it on its own
     * pages, but this route serves only the white-label email layout.
     */
    @Test
    void studioWithoutWhiteLabelIsNotFoundEvenWithALogo() {
        studio("tenants/anna/logo.png", Plan.STARTER);

        assertThatThrownBy(() -> service.logoUrlForSubdomain("anna-foto"))
            .isInstanceOf(NotFoundException.class);
        // Nothing is signed for a studio the route will not serve.
        verify(urlResolver, never()).resolve(any());
    }

    @Test
    void unknownSubdomainIsNotFound() {
        when(tenantResolver.requireBySubdomain("nobody"))
            .thenThrow(new NotFoundException("Photographer not found: nobody"));

        assertThatThrownBy(() -> service.logoUrlForSubdomain("nobody"))
            .isInstanceOf(NotFoundException.class);
    }
}
