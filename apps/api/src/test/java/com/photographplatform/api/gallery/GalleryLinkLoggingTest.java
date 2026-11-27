package com.photographplatform.api.gallery;

import com.jayway.jsonpath.JsonPath;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.cache.GateCache;
import com.photographplatform.api.common.config.ClockConfig;
import com.photographplatform.api.common.config.SecurityConfig;
import com.photographplatform.api.common.logging.RequestId;
import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.security.RestAuthEntryPoints;
import com.photographplatform.api.common.security.TenantContextFilter;
import com.photographplatform.api.common.security.TokenRevocationCheck;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.gallery.controller.GalleryController;
import com.photographplatform.api.gallery.service.GalleryArchiveWriter;
import com.photographplatform.api.gallery.service.GalleryService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import com.photographplatform.api.tenant.service.PublicTenantResolver.PublicPhotographer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The Customer's gallery link is {@code /api/public/galleries/{subdomain}/{token}},
 * and the token is the only thing standing between the gallery and anyone who
 * has the link. Through the real filter chain and dispatch, nothing logged for
 * that request — the access line, an error, anything — may contain it.
 */
@WebMvcTest(GalleryController.class)
@Import({
    SecurityConfig.class, RestAuthEntryPoints.class, ClockConfig.class,
    JwtAuthFilter.class, TenantContextFilter.class, JwtService.class
})
@ExtendWith(OutputCaptureExtension.class)
class GalleryLinkLoggingTest {

    private static final String TOKEN = "q7Wm2-gallery-token-do-not-log";
    private static final String LINK = "/api/public/galleries/atelier-lichtblick/" + TOKEN;
    private static final String ROUTE = "/api/public/galleries/{subdomain}/{token}";

    @Autowired private MockMvc mvc;

    @MockitoBean private GalleryService galleryService;
    @MockitoBean private PublicTenantResolver tenantResolver;
    @MockitoBean private GalleryArchiveWriter archiveWriter;
    /** Needed by the interceptors {@code @WebMvcTest} picks up; see InquirySecurityRuleTest. */
    @MockitoBean private UserRepository userRepository;
    @MockitoBean private TenantRepository tenantRepository;
    @MockitoBean private EntitlementService entitlementService;
    @MockitoBean private GateCache gateCache;
    @MockitoBean private TokenRevocationCheck tokenRevocationCheck;

    @Test
    void anOpenedGalleryIsLoggedByRoute(CapturedOutput log) throws Exception {
        when(tenantResolver.requirePhotographer("atelier-lichtblick")).thenReturn(
            new PublicPhotographer(new Tenant("atelier-lichtblick", "anna@example.test"), "Atelier", null));

        mvc.perform(get(LINK)).andExpect(status().isOk());

        assertThat(log.getAll())
            .contains("GET " + ROUTE + " -> 200")
            .doesNotContain(TOKEN)
            .doesNotContain("atelier-lichtblick");
    }

    @Test
    void aGalleryLinkThatFailsIsLoggedByRouteAndAnsweredWithTheRequestId(CapturedOutput log) throws Exception {
        when(tenantResolver.requirePhotographer("atelier-lichtblick"))
            .thenThrow(new RuntimeException("lookup failed"));

        MvcResult result = mvc.perform(get(LINK))
            .andExpect(status().isInternalServerError())
            .andReturn();

        String requestId = result.getResponse().getHeader(RequestId.RESPONSE_HEADER);
        assertThat(requestId).isNotBlank();
        String body = result.getResponse().getContentAsString();
        assertThat((String) JsonPath.read(body, "$.requestId")).isEqualTo(requestId);
        assertThat(log.getAll())
            .contains("Unhandled exception on " + ROUTE)
            .contains("GET " + ROUTE + " -> 500")
            .doesNotContain(TOKEN);
    }
}
