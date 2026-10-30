package com.photographplatform.api.privacy;

import static com.photographplatform.api.common.CsrfTestSupport.xsrf;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.auth.service.OwnershipGuard;
import com.photographplatform.api.common.cache.GateCache;
import com.photographplatform.api.common.config.ClockConfig;
import com.photographplatform.api.common.config.SecurityConfig;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.RetentionBasis;
import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.security.RestAuthEntryPoints;
import com.photographplatform.api.common.security.TenantContextFilter;
import com.photographplatform.api.common.security.TokenRevocationCheck;
import com.photographplatform.api.common.security.WriteAccessInterceptor;
import com.photographplatform.api.entitlement.config.EntitlementProperties;
import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.payment.config.PaymentProperties;
import com.photographplatform.api.privacy.api.ErasureRequest;
import com.photographplatform.api.privacy.api.PrivacyController;
import com.photographplatform.api.privacy.application.PersonalDataErasureService;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.method.HandlerMethod;

/**
 * Who may erase a person's data from a studio, and whether a locked studio
 * still can.
 *
 * <p>A CUSTOMER shares the studio's tenant, so authentication proves nothing:
 * without the rule in {@link SecurityConfig}, any client could erase any other.
 */
@WebMvcTest(PrivacyController.class)
@Import({
    SecurityConfig.class, RestAuthEntryPoints.class, ClockConfig.class,
    JwtAuthFilter.class, TenantContextFilter.class, JwtService.class
})
class PrivacySecurityRuleTest {

    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final String BODY = "{\"email\":\"maria@example.test\"}";

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;

    @MockitoBean private PersonalDataErasureService erasureService;
    @MockitoBean private OwnershipGuard ownershipGuard;
    /** Needed by WebMvcConfig's interceptors, not by this controller. */
    @MockitoBean private UserRepository userRepository;
    @MockitoBean private TenantRepository tenantRepository;
    @MockitoBean private EntitlementService entitlementService;
    @MockitoBean private GateCache gateCache;
    @MockitoBean private TokenRevocationCheck tokenRevocationCheck;

    @BeforeEach
    void assumeALiveSession() {
        when(tokenRevocationCheck.isTokenStillValid(any(), any())).thenReturn(true);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void thePhotographerGetsAPreviewWithTheRetentionReasons() throws Exception {
        when(erasureService.preview("maria@example.test")).thenReturn(List.of(
            ErasureOutcome.anonymized("bookings", 2),
            ErasureOutcome.deleted("leads", 0),
            ErasureOutcome.retained("invoices", 1, RetentionBasis.TAX_RECORDS)));

        mvc.perform(post("/api/privacy/erasure/preview")
                .header("Authorization", bearer("PHOTOGRAPHER"))
                .contentType(MediaType.APPLICATION_JSON).content(BODY).with(xsrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.executed").value(false))
            // A kind of record with nothing found is left out of the report.
            .andExpect(jsonPath("$.items.length()").value(2))
            .andExpect(jsonPath("$.items[1].retentionBasis").value("TAX_RECORDS"));
    }

    @Test
    void thePhotographerCanErase() throws Exception {
        when(erasureService.erase(anyString(), nullable(String.class)))
            .thenReturn(List.of(ErasureOutcome.anonymized("bookings", 2)));

        mvc.perform(post("/api/privacy/erasure")
                .header("Authorization", bearer("PHOTOGRAPHER"))
                .contentType(MediaType.APPLICATION_JSON).content(BODY).with(xsrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.executed").value(true));
    }

    @Test
    void aCustomerCanNeitherPreviewNorErase() throws Exception {
        for (String path : List.of("/api/privacy/erasure/preview", "/api/privacy/erasure")) {
            mvc.perform(post(path)
                    .header("Authorization", bearer("CUSTOMER"))
                    .contentType(MediaType.APPLICATION_JSON).content(BODY).with(xsrf()))
                .andExpect(status().isForbidden());
        }
        verify(erasureService, never()).erase(anyString(), nullable(String.class));
        verify(erasureService, never()).preview(anyString());
    }

    @Test
    void unauthenticatedIsDenied() throws Exception {
        mvc.perform(post("/api/privacy/erasure")
                .contentType(MediaType.APPLICATION_JSON).content(BODY).with(xsrf()))
            .andExpect(status().is4xxClientError());
        verify(erasureService, never()).erase(anyString(), nullable(String.class));
    }

    @Test
    void somethingThatIsNotAnAddressIsRejectedBeforeAnythingRuns() throws Exception {
        mvc.perform(post("/api/privacy/erasure")
                .header("Authorization", bearer("PHOTOGRAPHER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"%\"}").with(xsrf()))
            .andExpect(status().is4xxClientError());
        verify(erasureService, never()).erase(anyString(), nullable(String.class));
    }

    /**
     * The duty to erase does not lapse with the subscription. Driven through
     * the real interceptor against the real controller method, as the billing
     * exemption is, because the behaviour is what has to hold.
     */
    @Test
    void aLockedStudioCanStillErase() throws Exception {
        WriteAccessInterceptor interceptor = interceptorWithLockedTenant();
        HandlerMethod erase = new HandlerMethod(
            new PrivacyController(erasureService, mock(OwnershipGuard.class)),
            PrivacyController.class.getMethod("erase", ErasureRequest.class, HttpServletRequest.class));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            UUID.randomUUID().toString(), null, List.of(new SimpleGrantedAuthority("ROLE_PHOTOGRAPHER"))));
        TenantContext.setTenant(TENANT_ID.toString());

        assertThatCode(() -> interceptor.preHandle(
            new MockHttpServletRequest("POST", "/api/privacy/erasure"), new MockHttpServletResponse(), erase))
            .doesNotThrowAnyException();
    }

    private String bearer(String role) {
        return "Bearer " + jwtService.generateToken(UUID.randomUUID(), TENANT_ID, role);
    }

    /** A real interceptor over a tenant whose trial ran out with no subscription. */
    private static WriteAccessInterceptor interceptorWithLockedTenant() {
        Instant now = Instant.parse("2026-08-22T12:00:00Z");
        Tenant lapsed = new Tenant("anna-foto", "anna@example.de");
        lapsed.setTrialEndsAt(OffsetDateTime.ofInstant(now, ZoneOffset.UTC).minusDays(1));
        TenantRepository repository = mock(TenantRepository.class);
        when(repository.findById(any())).thenReturn(Optional.of(lapsed));

        EntitlementProperties props = new EntitlementProperties();
        Map<Plan, EntitlementProperties.PlanConfig> tiers = new EnumMap<>(Plan.class);
        for (Plan plan : Plan.values()) {
            EntitlementProperties.PlanConfig config = new EntitlementProperties.PlanConfig();
            config.setCapabilities(EnumSet.noneOf(Capability.class));
            tiers.put(plan, config);
        }
        props.setTiers(tiers);
        return new WriteAccessInterceptor(repository,
            new EntitlementService(props, new PaymentProperties(), repository, Clock.fixed(now, ZoneOffset.UTC)),
            mock(GateCache.class));
    }
}
