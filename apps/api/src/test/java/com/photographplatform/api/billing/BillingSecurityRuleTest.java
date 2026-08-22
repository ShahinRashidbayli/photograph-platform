package com.photographplatform.api.billing;

import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.billing.controller.BillingController;
import com.photographplatform.api.billing.dto.BillingStatusResponse;
import com.photographplatform.api.billing.dto.CheckoutSessionResponse;
import com.photographplatform.api.billing.service.BillingService;
import com.photographplatform.api.common.config.SecurityConfig;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.AccountReadOnlyException;
import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.security.TenantContextFilter;
import com.photographplatform.api.common.security.WriteAccessInterceptor;
import com.photographplatform.api.entitlement.config.EntitlementProperties;
import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.payment.config.PaymentProperties;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
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

import static com.photographplatform.api.common.CsrfTestSupport.xsrf;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Who may reach the subscription, and — more importantly — whether a locked
 * account can still pay to unlock itself.
 *
 * <p>A CUSTOMER shares the photographer's tenant, so authentication proves
 * nothing here: without the explicit rule in {@link SecurityConfig}, a client
 * could read their photographer's plan and billing state, or open a Stripe
 * portal session against their customer record.
 */
@WebMvcTest(BillingController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, TenantContextFilter.class, JwtService.class})
class BillingSecurityRuleTest {

    private static final UUID TENANT_ID = UUID.randomUUID();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private BillingService billingService;

    /** Needed by WebMvcConfig's EmailVerificationInterceptor, not by this controller. */
    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private TenantRepository tenantRepository;

    @MockitoBean
    private EntitlementService entitlementService;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    private String tokenFor(String role) {
        return jwtService.generateToken(UUID.randomUUID(), TENANT_ID, role);
    }

    // ── the role boundary ───────────────────────────────────────────────

    @Test
    void photographerCanReadTheirBillingState() throws Exception {
        when(billingService.getStatus()).thenReturn(stubStatus());

        mvc.perform(get("/api/billing")
                .header("Authorization", "Bearer " + tokenFor("PHOTOGRAPHER")))
            .andExpect(status().isOk());
    }

    @Test
    void photographerCanStartACheckout() throws Exception {
        when(billingService.startCheckout(any(), nullable(String.class)))
            .thenReturn(new CheckoutSessionResponse("https://checkout.stripe.com/c/test"));

        mvc.perform(post("/api/billing/checkout")
                .header("Authorization", "Bearer " + tokenFor("PHOTOGRAPHER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"plan\":\"PRO\",\"interval\":\"MONTHLY\"}")
                .with(xsrf()))
            .andExpect(status().isOk());
    }

    /**
     * The client is not the party being billed, and shares the tenant — so
     * every one of these has to be refused on the role, not on the tenant.
     */
    @Test
    void aCustomerCannotSeeOrTouchTheirPhotographersSubscription() throws Exception {
        String customer = "Bearer " + tokenFor("CUSTOMER");

        mvc.perform(get("/api/billing").header("Authorization", customer))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/billing/portal").header("Authorization", customer).with(xsrf()))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/billing/checkout")
                .header("Authorization", customer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"plan\":\"STUDIO\",\"interval\":\"YEARLY\"}")
                .with(xsrf()))
            .andExpect(status().isForbidden());
    }

    /**
     * Asserted as "some 4xx", matching TenantSettingsSecurityRuleTest: with no
     * credentials at all Spring Security answers 403 here rather than 401, and
     * pinning the exact code would make this test about the entry-point
     * configuration rather than about billing being closed to strangers.
     */
    @Test
    void unauthenticatedIsDenied() throws Exception {
        mvc.perform(get("/api/billing")).andExpect(status().is4xxClientError());
        mvc.perform(post("/api/billing/portal").with(xsrf()))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void anUnknownPlanIsRejectedBeforeItReachesStripe() throws Exception {
        mvc.perform(post("/api/billing/checkout")
                .header("Authorization", "Bearer " + tokenFor("PHOTOGRAPHER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"plan\":\"ENTERPRISE\",\"interval\":\"MONTHLY\"}")
                .with(xsrf()))
            .andExpect(status().isUnprocessableEntity());
    }

    // ── the deadlock guard ──────────────────────────────────────────────

    /**
     * The single most important property of this controller.
     *
     * <p>The read-only lock blocks every mutating request from a lapsed
     * account, and subscribing is a POST. If billing were not exempt, the
     * account could never be unlocked: the photographer cannot pay, so they
     * stay locked, so they cannot pay. This drives the real interceptor against
     * the real controller class rather than asserting an annotation is present,
     * because it is the behaviour — not the annotation — that has to hold.
     */
    @Test
    void aLockedAccountCanStillReachBillingToPayItsWayOut() throws Exception {
        WriteAccessInterceptor interceptor = interceptorWithLockedTenant();
        HandlerMethod checkout = new HandlerMethod(
            new BillingController(billingService),
            BillingController.class.getMethod(
                "checkout",
                com.photographplatform.api.billing.dto.StartCheckoutRequest.class,
                jakarta.servlet.http.HttpServletRequest.class));

        authenticateAsPhotographer();

        assertThatCode(() -> interceptor.preHandle(
            new MockHttpServletRequest("POST", "/api/billing/checkout"),
            new MockHttpServletResponse(), checkout))
            .doesNotThrowAnyException();
    }

    /**
     * The counterpart: a control endpoint on the same locked tenant IS blocked,
     * proving the exemption above is specific to billing rather than the lock
     * being inert in this setup.
     */
    @Test
    void thatExemptionDoesNotLeakToOrdinaryEndpoints() {
        WriteAccessInterceptor interceptor = interceptorWithLockedTenant();
        authenticateAsPhotographer();

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> interceptor.preHandle(
            new MockHttpServletRequest("POST", "/api/bookings"),
            new MockHttpServletResponse(), new Object()))
            .isInstanceOf(AccountReadOnlyException.class);
    }

    private void authenticateAsPhotographer() {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                UUID.randomUUID().toString(), null,
                List.of(new SimpleGrantedAuthority("ROLE_PHOTOGRAPHER"))));
        TenantContext.setTenant(TENANT_ID.toString());
    }

    /** A real interceptor over a tenant whose trial ran out with no subscription. */
    private WriteAccessInterceptor interceptorWithLockedTenant() {
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

        return new WriteAccessInterceptor(repository, new EntitlementService(
            props, new PaymentProperties(), repository, Clock.fixed(now, ZoneOffset.UTC)));
    }

    private static BillingStatusResponse stubStatus() {
        return new BillingStatusResponse(
            "STARTER", "TRIALING", OffsetDateTime.now().plusDays(7), null,
            true, false, true, null);
    }
}
