package com.photographplatform.api.contract;

import static com.photographplatform.api.common.CsrfTestSupport.xsrf;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.cache.GateCache;
import com.photographplatform.api.common.config.ClockConfig;
import com.photographplatform.api.common.config.SecurityConfig;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.security.RestAuthEntryPoints;
import com.photographplatform.api.common.security.TenantContextFilter;
import com.photographplatform.api.common.security.TokenRevocationCheck;
import com.photographplatform.api.contract.controller.ContractController;
import com.photographplatform.api.contract.dto.ContractResponse;
import com.photographplatform.api.contract.service.ContractService;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Sending a contract, and "Erneut senden": the photographer gets through, with
 * or without a personal note, and the endpoints answer what the service says.
 *
 * <p>The negative direction (a CUSTOMER is refused) is covered for every route
 * by {@code EndpointRoleMatrixIT}.
 */
@WebMvcTest(ContractController.class)
@Import({
    SecurityConfig.class, RestAuthEntryPoints.class, ClockConfig.class,
    JwtAuthFilter.class, TenantContextFilter.class, JwtService.class
})
class ContractSecurityRuleTest {

    private static final UUID TENANT_ID = UUID.randomUUID();

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;

    @MockitoBean private ContractService contractService;
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

    @Test
    void thePhotographerCanSendWithoutABody() throws Exception {
        UUID id = UUID.randomUUID();
        when(contractService.send(eq(id), isNull(), nullable(String.class))).thenReturn(sent(id));

        mvc.perform(post("/api/contracts/" + id + "/send")
                .header("Authorization", bearer("PHOTOGRAPHER")).with(xsrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SENT"));
    }

    @Test
    void thePhotographerCanSendWithAPersonalNote() throws Exception {
        UUID id = UUID.randomUUID();
        when(contractService.send(eq(id), eq("Bis Freitag bitte."), nullable(String.class)))
            .thenReturn(sent(id));

        mvc.perform(post("/api/contracts/" + id + "/send")
                .header("Authorization", bearer("PHOTOGRAPHER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Bis Freitag bitte.\"}")
                .with(xsrf()))
            .andExpect(status().isOk());
    }

    @Test
    void thePhotographerCanResend() throws Exception {
        UUID id = UUID.randomUUID();
        when(contractService.resend(eq(id), eq("Nochmal für Sie."), nullable(String.class)))
            .thenReturn(sent(id));

        mvc.perform(post("/api/contracts/" + id + "/resend")
                .header("Authorization", bearer("PHOTOGRAPHER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Nochmal für Sie.\"}")
                .with(xsrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SENT"));
    }

    @Test
    void anAdminCanResendWithoutABody() throws Exception {
        UUID id = UUID.randomUUID();
        when(contractService.resend(eq(id), isNull(), nullable(String.class))).thenReturn(sent(id));

        mvc.perform(post("/api/contracts/" + id + "/resend")
                .header("Authorization", bearer("ADMIN")).with(xsrf()))
            .andExpect(status().isOk());
    }

    /** F-23: resending anything but a SENT contract answered 500. */
    @Test
    void resendingAContractThatIsNotSentAnswersConflict() throws Exception {
        UUID id = UUID.randomUUID();
        when(contractService.resend(eq(id), isNull(), nullable(String.class)))
            .thenThrow(new ConflictException("Only a contract waiting for its signature can be sent again"));

        mvc.perform(post("/api/contracts/" + id + "/resend")
                .header("Authorization", bearer("PHOTOGRAPHER")).with(xsrf()))
            .andExpect(status().isConflict());
    }

    /** A personal note is at most 1000 characters; the DTO refuses the 1001st. */
    @Test
    void aPersonalNoteOverTheLimitIsRejected() throws Exception {
        for (String action : new String[] {"send", "resend"}) {
            mvc.perform(post("/api/contracts/" + UUID.randomUUID() + "/" + action)
                    .header("Authorization", bearer("PHOTOGRAPHER"))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"" + "x".repeat(1001) + "\"}")
                    .with(xsrf()))
                .andExpect(status().isUnprocessableEntity());
        }
        verify(contractService, never()).send(any(), any(), any());
        verify(contractService, never()).resend(any(), any(), any());
    }

    @Test
    void unauthenticatedIsDenied() throws Exception {
        mvc.perform(post("/api/contracts/" + UUID.randomUUID() + "/resend").with(xsrf()))
            .andExpect(status().is4xxClientError());
        verify(contractService, never()).resend(any(), any(), any());
    }

    private String bearer(String role) {
        return "Bearer " + jwtService.generateToken(UUID.randomUUID(), TENANT_ID, role);
    }

    private static ContractResponse sent(UUID id) {
        OffsetDateTime now = OffsetDateTime.now();
        return new ContractResponse(id, UUID.randomUUID(), "SENT", "Vertrag", "Text", "Emma Clarke",
            "emma@example.test", "Anna Müller", null, null, null, null, now, null, now, false, false);
    }
}
