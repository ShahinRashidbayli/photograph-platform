package com.photographplatform.api.inquiry;

import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.ClockConfig;
import com.photographplatform.api.common.cache.GateCache;
import com.photographplatform.api.common.config.SecurityConfig;
import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.TokenRevocationCheck;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.security.RestAuthEntryPoints;
import com.photographplatform.api.common.security.TenantContextFilter;
import com.photographplatform.api.inquiry.controller.CustomerInquiryController;
import com.photographplatform.api.inquiry.controller.InquiryController;
import com.photographplatform.api.inquiry.dto.InquiryRequestResponse;
import com.photographplatform.api.inquiry.service.InquiryRequestService;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static com.photographplatform.api.common.CsrfTestSupport.xsrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Drives the real filter chain with genuine signed JWTs to prove the inquiry
 * role boundary end-to-end at the web layer.
 *
 * <p>Threat model: CUSTOMER tokens are minted by {@code CustomerAuthService} and
 * are scoped to the *photographer's* tenant. So authentication alone proves
 * nothing here — without the explicit gates in {@link SecurityConfig}, a
 * customer holding a perfectly valid token could read the photographer's whole
 * inquiry inbox (every other customer's name, email, budget and message). A 403
 * rather than a 401 is the assertion that matters: it says the token
 * authenticated fine and was turned away on role.
 */
@WebMvcTest({CustomerInquiryController.class, InquiryController.class})
@Import({
    SecurityConfig.class, RestAuthEntryPoints.class, ClockConfig.class,
    JwtAuthFilter.class, TenantContextFilter.class, JwtService.class
})
class InquirySecurityRuleTest {

    private static final UUID TENANT_ID = UUID.randomUUID();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private InquiryRequestService inquiryService;

    /**
     * Not used by these controllers, but {@code WebMvcConfig} is picked up by
     * {@code @WebMvcTest} and its {@code EmailVerificationInterceptor} needs a
     * {@code UserRepository} to construct. Without this the whole context fails
     * to load.
     */
    @MockitoBean
    private UserRepository userRepository;

    private String customerToken() {
        return jwtService.generateToken(UUID.randomUUID(), TENANT_ID, "CUSTOMER");
    }

    private String photographerToken() {
        return jwtService.generateToken(UUID.randomUUID(), TENANT_ID, "PHOTOGRAPHER");
    }

    private static String validBody() {
        return """
            {"eventType":"HOCHZEIT","budgetRange":"1000_2000",
             "proposedDate":"%s","location":"Berlin","message":"Looking forward",
             "website":""}
            """.formatted(LocalDate.now().plusDays(90));
    }

    private static InquiryRequestResponse stubResponse() {
        return new InquiryRequestResponse(
            UUID.randomUUID(), "Maria Kellner", "maria@example.com",
            "HOCHZEIT", "1000_2000", LocalDate.now().plusDays(90),
            "Berlin", "Looking forward", "HIGH", "PENDING", "BIO_LINK", "de", null);
    }

    // ── the customer's own surface ────────────────────────────────────────────

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
    void customerCanSubmitAnInquiry() throws Exception {
        when(inquiryService.create(any(), nullable(String.class))).thenReturn(stubResponse());

        mvc.perform(post("/api/customer/inquiry-requests")
                .header("Authorization", "Bearer " + customerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validBody())
                .with(xsrf()))
            .andExpect(status().isCreated());
    }

    @Test
    void customerCanListOwnInquiries() throws Exception {
        when(inquiryService.listForCustomer(anyInt(), anyInt())).thenReturn(List.of());

        mvc.perform(get("/api/customer/inquiry-requests")
                .header("Authorization", "Bearer " + customerToken()))
            .andExpect(status().isOk());
    }

    /** A tripped honeypot looks like success to the bot but persists nothing. */
    @Test
    void honeypotSubmissionIsAcceptedButNeverPersisted() throws Exception {
        String botBody = """
            {"eventType":"HOCHZEIT","budgetRange":"1000_2000",
             "proposedDate":"%s","website":"http://spam.example"}
            """.formatted(LocalDate.now().plusDays(90));

        mvc.perform(post("/api/customer/inquiry-requests")
                .header("Authorization", "Bearer " + customerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(botBody)
                .with(xsrf()))
            .andExpect(status().isAccepted());

        verify(inquiryService, never()).create(any(), nullable(String.class));
    }

    /** The tenant-schema table has no CHECK on these columns — the DTO is the gate. */
    @Test
    void unknownEnumValueIsRejected() throws Exception {
        String badBody = """
            {"eventType":"WEDDING","budgetRange":"1000_2000","proposedDate":"%s"}
            """.formatted(LocalDate.now().plusDays(90));

        mvc.perform(post("/api/customer/inquiry-requests")
                .header("Authorization", "Bearer " + customerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(badBody)
                .with(xsrf()))
            .andExpect(status().isUnprocessableEntity());

        verify(inquiryService, never()).create(any(), nullable(String.class));
    }

    @Test
    void pastDateIsRejected() throws Exception {
        String pastBody = """
            {"eventType":"HOCHZEIT","budgetRange":"1000_2000","proposedDate":"%s"}
            """.formatted(LocalDate.now().minusDays(1));

        mvc.perform(post("/api/customer/inquiry-requests")
                .header("Authorization", "Bearer " + customerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(pastBody)
                .with(xsrf()))
            .andExpect(status().isUnprocessableEntity());
    }

    // ── the role boundary ─────────────────────────────────────────────────────

    /** The whole point of the gate: a valid customer token must not read the inbox. */
    @Test
    void customerTokenIsForbiddenFromThePhotographerInbox() throws Exception {
        mvc.perform(get("/api/inquiries")
                .header("Authorization", "Bearer " + customerToken()))
            .andExpect(status().isForbidden());
    }

    @Test
    void photographerTokenIsForbiddenFromTheCustomerSurface() throws Exception {
        mvc.perform(post("/api/customer/inquiry-requests")
                .header("Authorization", "Bearer " + photographerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validBody())
                .with(xsrf()))
            .andExpect(status().isForbidden());
    }

    @Test
    void photographerCanReadTheInbox() throws Exception {
        when(inquiryService.listForPhotographer(nullable(String.class), anyInt(), anyInt()))
            .thenReturn(List.of());

        mvc.perform(get("/api/inquiries")
                .header("Authorization", "Bearer " + photographerToken()))
            .andExpect(status().isOk());
    }

    @Test
    void photographerDecidesWithAPersonalNote() throws Exception {
        UUID id = UUID.randomUUID();
        when(inquiryService.updateStatus(eq(id), eq("REJECTED"), eq("Leider ausgebucht."),
            nullable(String.class))).thenReturn(stubResponse());

        mvc.perform(patch("/api/inquiries/" + id + "/status")
                .header("Authorization", "Bearer " + photographerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"REJECTED\",\"note\":\"Leider ausgebucht.\"}")
                .with(xsrf()))
            .andExpect(status().isOk());
    }

    /** A personal note is at most 1000 characters; the DTO refuses the 1001st. */
    @Test
    void aPersonalNoteOverTheLimitIsRejected() throws Exception {
        mvc.perform(patch("/api/inquiries/" + UUID.randomUUID() + "/status")
                .header("Authorization", "Bearer " + photographerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"REJECTED\",\"note\":\"" + "x".repeat(1001) + "\"}")
                .with(xsrf()))
            .andExpect(status().isUnprocessableEntity());

        verify(inquiryService, never()).updateStatus(any(), any(), any(), any());
    }

    @Test
    void unauthenticatedIsDeniedFromBothSurfaces() throws Exception {
        mvc.perform(get("/api/inquiries"))
            .andExpect(status().is4xxClientError());

        mvc.perform(post("/api/customer/inquiry-requests")
                .contentType(MediaType.APPLICATION_JSON)
                .content(validBody())
                .with(xsrf()))
            .andExpect(status().is4xxClientError());
    }

    /**
     * Both gates consult this before their repository read, so the slice needs
     * it to exist. A mock reports every gate as unrecorded, which sends each
     * request down the same full path it took before the cache existed — the
     * behaviour these tests were written against.
     */
    @MockitoBean
    private GateCache gateCache;


    /**
     * JwtAuthFilter now asks whether each token has been revoked since it was
     * issued. These tests are about the role boundary and assume a live
     * session, so the answer is always "still valid" — revocation itself is
     * covered by JwtAuthFilterTest.
     */
    @MockitoBean
    private TokenRevocationCheck tokenRevocationCheck;

    @BeforeEach
    void assumeALiveSession() {
        when(tokenRevocationCheck.isTokenStillValid(any(), any())).thenReturn(true);
    }

}
