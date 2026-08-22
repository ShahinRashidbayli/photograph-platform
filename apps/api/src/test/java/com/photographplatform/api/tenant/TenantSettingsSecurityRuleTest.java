package com.photographplatform.api.tenant;

import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.SecurityConfig;
import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.security.TenantContextFilter;
import com.photographplatform.api.payment.dto.StripeConnectStatusResponse;
import com.photographplatform.api.payment.service.StripeConnectService;
import com.photographplatform.api.tenant.controller.TenantSettingsController;
import com.photographplatform.api.tenant.dto.BillingProfileResponse;
import com.photographplatform.api.tenant.service.TenantSettingsService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static com.photographplatform.api.common.CsrfTestSupport.xsrf;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The role boundary on tenant settings, driven through the real filter chain.
 *
 * <p>Why it needs its own gate: a CUSTOMER's JWT is minted against the
 * <em>photographer's</em> tenant, so authentication proves nothing here.
 * Without the explicit rule in {@link SecurityConfig}, any client could read
 * their photographer's Steuernummer and — worse — rewrite the business
 * identity that gets printed on every invoice, or start/redirect the Stripe
 * account the money lands in.
 */
@WebMvcTest(TenantSettingsController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, TenantContextFilter.class, JwtService.class})
class TenantSettingsSecurityRuleTest {

    private static final UUID TENANT_ID = UUID.randomUUID();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private TenantSettingsService settingsService;

    @MockitoBean
    private StripeConnectService connectService;

    /** Needed by WebMvcConfig's EmailVerificationInterceptor, not by this controller. */
    @MockitoBean
    private UserRepository userRepository;

    private String tokenFor(String role) {
        return jwtService.generateToken(UUID.randomUUID(), TENANT_ID, role);
    }

    private static String validProfile() {
        return """
            {"businessName":"Anna Fotografie","addressLine1":"Musterstraße 1",
             "postalCode":"10115","city":"Berlin","country":"DE",
             "taxId":"21/815/08150","taxMode":"KLEINUNTERNEHMER"}
            """;
    }

    private static BillingProfileResponse stubProfile() {
        return new BillingProfileResponse("Anna Fotografie", "Musterstraße 1", null,
            "10115", "Berlin", "DE", "21/815/08150", null, "KLEINUNTERNEHMER", true);
    }

    // ── the photographer's own surface ────────────────────────────────────

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
    void photographerCanReadTheBillingProfile() throws Exception {
        when(settingsService.getBillingProfile()).thenReturn(stubProfile());

        mvc.perform(get("/api/settings/billing-profile")
                .header("Authorization", "Bearer " + tokenFor("PHOTOGRAPHER")))
            .andExpect(status().isOk());
    }

    @Test
    void photographerCanUpdateTheBillingProfile() throws Exception {
        when(settingsService.updateBillingProfile(any(), nullable(String.class)))
            .thenReturn(stubProfile());

        mvc.perform(put("/api/settings/billing-profile")
                .header("Authorization", "Bearer " + tokenFor("PHOTOGRAPHER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(validProfile())
                .with(xsrf()))
            .andExpect(status().isOk());
    }

    @Test
    void photographerCanReadStripeStatus() throws Exception {
        when(connectService.getStatus()).thenReturn(new StripeConnectStatusResponse(
            true, null, false, false, false, null, "STARTER", 200));

        mvc.perform(get("/api/settings/stripe")
                .header("Authorization", "Bearer " + tokenFor("PHOTOGRAPHER")))
            .andExpect(status().isOk());
    }

    // ── validation ────────────────────────────────────────────────────────

    /**
     * §14 Abs. 4 Nr. 1 UStG makes the issuer's address mandatory, and an
     * invoice is GoBD-immutable once issued — so a blank field caught here is
     * a field that can never be corrected on a document later.
     */
    @Test
    void incompleteProfileIsRejectedBeforeItReachesTheService() throws Exception {
        String missingCity = """
            {"businessName":"Anna Fotografie","addressLine1":"Musterstraße 1",
             "postalCode":"10115","city":"","country":"DE",
             "taxId":"21/815/08150","taxMode":"KLEINUNTERNEHMER"}
            """;

        mvc.perform(put("/api/settings/billing-profile")
                .header("Authorization", "Bearer " + tokenFor("PHOTOGRAPHER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(missingCity)
                .with(xsrf()))
            .andExpect(status().isUnprocessableEntity());

        verify(settingsService, never()).updateBillingProfile(any(), nullable(String.class));
    }

    @Test
    void countryMustBeATwoLetterIsoCode() throws Exception {
        String badCountry = validProfile().replace("\"country\":\"DE\"", "\"country\":\"Germany\"");

        mvc.perform(put("/api/settings/billing-profile")
                .header("Authorization", "Bearer " + tokenFor("PHOTOGRAPHER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(badCountry)
                .with(xsrf()))
            .andExpect(status().isUnprocessableEntity());
    }

    // ── the role boundary ─────────────────────────────────────────────────

    @Test
    void customerTokenCannotReadTheBillingProfile() throws Exception {
        mvc.perform(get("/api/settings/billing-profile")
                .header("Authorization", "Bearer " + tokenFor("CUSTOMER")))
            .andExpect(status().isForbidden());
    }

    @Test
    void customerTokenCannotRewriteTheInvoiceIssuer() throws Exception {
        mvc.perform(put("/api/settings/billing-profile")
                .header("Authorization", "Bearer " + tokenFor("CUSTOMER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(validProfile())
                .with(xsrf()))
            .andExpect(status().isForbidden());

        verify(settingsService, never()).updateBillingProfile(any(), nullable(String.class));
    }

    /** Starting onboarding decides which Stripe account the money lands in. */
    @Test
    void customerTokenCannotStartStripeOnboarding() throws Exception {
        mvc.perform(post("/api/settings/stripe/onboarding-link")
                .header("Authorization", "Bearer " + tokenFor("CUSTOMER"))
                .with(xsrf()))
            .andExpect(status().isForbidden());

        verify(connectService, never()).createOnboardingLink(nullable(String.class));
    }

    @Test
    void unauthenticatedIsDenied() throws Exception {
        mvc.perform(get("/api/settings/billing-profile"))
            .andExpect(status().is4xxClientError());

        mvc.perform(put("/api/settings/billing-profile")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validProfile())
                .with(xsrf()))
            .andExpect(status().is4xxClientError());
    }
}
