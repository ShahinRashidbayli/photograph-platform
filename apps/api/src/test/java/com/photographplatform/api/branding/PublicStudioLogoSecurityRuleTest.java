package com.photographplatform.api.branding;

import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.branding.controller.PublicStudioLogoController;
import com.photographplatform.api.branding.service.BrandingService;
import com.photographplatform.api.common.cache.GateCache;
import com.photographplatform.api.common.config.ClockConfig;
import com.photographplatform.api.common.config.SecurityConfig;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.security.RestAuthEntryPoints;
import com.photographplatform.api.common.security.TenantContextFilter;
import com.photographplatform.api.common.security.TokenRevocationCheck;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.repository.TenantRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The logo route through the real security filter chain: an anonymous mail
 * client gets the redirect, and the redirect is not cached past its target.
 */
@WebMvcTest(PublicStudioLogoController.class)
@Import({
    SecurityConfig.class, RestAuthEntryPoints.class, ClockConfig.class,
    JwtAuthFilter.class, TenantContextFilter.class, JwtService.class
})
class PublicStudioLogoSecurityRuleTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private BrandingService brandingService;

    /** WebMvcConfig's interceptors need these to construct; inert here. */
    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private TenantRepository tenantRepository;

    @MockitoBean
    private EntitlementService entitlementService;

    @MockitoBean
    private GateCache gateCache;

    @MockitoBean
    private TokenRevocationCheck tokenRevocationCheck;

    @Test
    void anonymousCallerIsRedirectedToAFreshlySignedUrl() throws Exception {
        when(brandingService.logoUrlForSubdomain("anna-foto")).thenReturn("https://r2.test/logo.png?sig=1");

        mvc.perform(get("/api/public/studios/anna-foto/logo"))
            .andExpect(status().isFound())
            .andExpect(header().string("Location", "https://r2.test/logo.png?sig=1"))
            .andExpect(header().string("Cache-Control", "max-age=300"));
    }

    @Test
    void noLogoToServeIsNotFound() throws Exception {
        when(brandingService.logoUrlForSubdomain("anna-foto")).thenThrow(new NotFoundException("Logo not found"));

        mvc.perform(get("/api/public/studios/anna-foto/logo"))
            .andExpect(status().isNotFound());
    }
}
