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
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

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

    private static final UUID STUDIO_ID = UUID.fromString("7d0c8a4e-2b1f-4c3a-9e6d-5f4a3b2c1d0e");
    /** What the logo presign endpoint mints: {@code logos/<tenant>/<uuid><ext>}. */
    private static final String LOGO_KEY = "logos/" + STUDIO_ID + "/0b6f1c2d-3e4f-4a5b-8c7d-9e0f1a2b3c4d.png";

    private Tenant studio(String logoKey, Plan plan, Capability... capabilities) {
        Tenant tenant = new Tenant("anna-foto", "anna@example.test");
        ReflectionTestUtils.setField(tenant, "id", STUDIO_ID);
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
        studio(LOGO_KEY, Plan.STUDIO, Capability.WHITE_LABEL_BRANDING);
        when(urlResolver.resolve(LOGO_KEY)).thenReturn("https://r2.test/logo.png?sig=1");

        assertThat(service.logoUrlForSubdomain("anna-foto")).isEqualTo("https://r2.test/logo.png?sig=1");
    }

    @Test
    void studioWithoutALogoIsNotFound() {
        studio(null, Plan.STUDIO, Capability.WHITE_LABEL_BRANDING);

        assertThatThrownBy(() -> service.logoUrlForSubdomain("anna-foto"))
            .isInstanceOf(NotFoundException.class);
    }

    /**
     * A studio that uploaded a logo and then downgraded keeps it on its own
     * pages, but this route serves only the white-label email layout.
     */
    @Test
    void studioWithoutWhiteLabelIsNotFoundEvenWithALogo() {
        studio(LOGO_KEY, Plan.STARTER);

        assertThatThrownBy(() -> service.logoUrlForSubdomain("anna-foto"))
            .isInstanceOf(NotFoundException.class);
        // Nothing is signed for a studio the route will not serve.
        verify(urlResolver, never()).resolve(any());
    }

    /**
     * {@code logoKey} is stored as the owner sent it. Anything but this
     * studio's own logo object would make the public route an open redirect,
     * or a signer for any object in the bucket.
     */
    @ParameterizedTest
    @ValueSource(strings = {
        "https://evil.example/phish",
        "//evil.example/phish",
        "galleries/7d0c8a4e-2b1f-4c3a-9e6d-5f4a3b2c1d0e/originals/a.jpg",
        "logos/11111111-2222-4333-8444-555555555555/0b6f1c2d-3e4f-4a5b-8c7d-9e0f1a2b3c4d.png",
        "logos/7d0c8a4e-2b1f-4c3a-9e6d-5f4a3b2c1d0e/../../galleries/x.jpg",
    })
    void keyThatIsNotThisStudiosLogoObjectIsNotFound(String logoKey) {
        studio(logoKey, Plan.STUDIO, Capability.WHITE_LABEL_BRANDING);

        assertThatThrownBy(() -> service.logoUrlForSubdomain("anna-foto"))
            .isInstanceOf(NotFoundException.class);
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
