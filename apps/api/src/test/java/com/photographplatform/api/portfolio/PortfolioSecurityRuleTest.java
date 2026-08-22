package com.photographplatform.api.portfolio;

import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.SecurityConfig;
import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.security.TenantContextFilter;
import com.photographplatform.api.portfolio.controller.PortfolioController;
import com.photographplatform.api.portfolio.service.PhotoService;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static com.photographplatform.api.common.CsrfTestSupport.xsrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fast (no-Docker) verification of the {@code /api/portfolio/**} authorization
 * rule in {@link SecurityConfig}. Drives the real security filter chain —
 * {@link JwtAuthFilter}, {@link TenantContextFilter} and the {@code SecurityFilterChain}
 * — with genuine signed JWTs, so it proves the role gate end-to-end at the web
 * layer without needing a database.
 *
 * <p>The end-to-end counterpart that exercises the same rule against a real
 * Postgres schema is {@code PortfolioAuthorizationIT}.
 */
@WebMvcTest(PortfolioController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, TenantContextFilter.class, JwtService.class})
class PortfolioSecurityRuleTest {

    private static final UUID TENANT_ID = UUID.randomUUID();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private PhotoService photoService;

    /**
     * The public portfolio endpoint resolves its photographer through this
     * rather than the two repositories it used to reach for directly.
     */
    @MockitoBean
    private PublicTenantResolver tenantResolver;

    /**
     * Not used by this controller any more, but {@code WebMvcConfig}'s
     * {@code EmailVerificationInterceptor} still needs one to construct.
     */
    @MockitoBean
    private UserRepository userRepository;

    /** A CUSTOMER token authenticates fine but must be denied on role (403, not 401). */
    /**
     * WriteAccessInterceptor sits in the real chain these slices run through,
     * so its collaborators have to exist. Mocked rather than configured: this
     * test is about the role boundary, and a mocked requireWritable() is inert,
     * which keeps the read-only lock from quietly becoming the thing under
     * test. The lock has its own coverage in WriteAccessInterceptorTest.
     */
    @MockitoBean
    private TenantRepository tenantRepository;

    @MockitoBean
    private EntitlementService entitlementService;

    @Test
    void customerTokenIsForbiddenFromPortfolioList() throws Exception {
        String token = jwtService.generateToken(UUID.randomUUID(), TENANT_ID, "CUSTOMER");
        mvc.perform(get("/api/portfolio/photos").header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    /** CSRF is satisfied here, so a 403 isolates the role gate as the cause. */
    @Test
    void customerTokenIsForbiddenFromUpload() throws Exception {
        String token = jwtService.generateToken(UUID.randomUUID(), TENANT_ID, "CUSTOMER");
        mvc.perform(post("/api/portfolio/photos/initiate-upload")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"filename\":\"a.jpg\",\"contentType\":\"image/jpeg\"}")
                .with(xsrf()))
            .andExpect(status().isForbidden());
    }

    /** Same URL, same tenant — the PHOTOGRAPHER role gets through. */
    @Test
    void photographerTokenIsAllowedIntoPortfolioList() throws Exception {
        when(photoService.listAll()).thenReturn(List.of());
        String token = jwtService.generateToken(UUID.randomUUID(), TENANT_ID, "PHOTOGRAPHER");
        mvc.perform(get("/api/portfolio/photos").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());
    }

    @Test
    void unauthenticatedIsDeniedFromPortfolioList() throws Exception {
        mvc.perform(get("/api/portfolio/photos"))
            .andExpect(status().is4xxClientError());
    }
}
