package com.photographplatform.api.invoice;

import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.cache.GateCache;
import com.photographplatform.api.common.config.ClockConfig;
import com.photographplatform.api.common.config.SecurityConfig;
import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.security.RestAuthEntryPoints;
import com.photographplatform.api.common.security.TenantContextFilter;
import com.photographplatform.api.common.security.TokenRevocationCheck;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.invoice.controller.InvoiceController;
import com.photographplatform.api.invoice.service.InvoiceService;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static com.photographplatform.api.common.CsrfTestSupport.xsrf;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fast (no-Docker) checks of what an invoice request may carry, through the
 * real filter chain and validation, the way {@code BookingSecurityRuleTest}
 * checks a booking's date.
 *
 * <p>An issued invoice cannot be edited, only cancelled by a Storno that
 * copies it, so a value the database would store differently from what the
 * PDF prints has to be refused before anything is issued.
 */
@WebMvcTest(InvoiceController.class)
@Import({
    SecurityConfig.class, RestAuthEntryPoints.class, ClockConfig.class,
    JwtAuthFilter.class, TenantContextFilter.class, JwtService.class
})
class InvoiceRequestValidationTest {

    private static final UUID TENANT_ID = UUID.randomUUID();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private InvoiceService invoiceService;

    /** Collaborators of the real chain; see BookingSecurityRuleTest for why each is mocked. */
    @MockitoBean
    private TenantRepository tenantRepository;

    @MockitoBean
    private EntitlementService entitlementService;

    @MockitoBean
    private GateCache gateCache;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private TokenRevocationCheck tokenRevocationCheck;

    @BeforeEach
    void assumeALiveSession() {
        when(tokenRevocationCheck.isTokenStillValid(any(), any())).thenReturn(true);
    }

    private ResultActions issueWithQuantity(String quantity) throws Exception {
        String body = """
            {"lineItems":[{"description":"Shoot","quantity":%s,
              "unitPriceCents":10000,"taxCategory":"STANDARD"}]}
            """.formatted(quantity);
        return mvc.perform(post("/api/bookings/" + UUID.randomUUID() + "/invoices")
            .header("Authorization", "Bearer "
                + jwtService.generateToken(UUID.randomUUID(), TENANT_ID, "PHOTOGRAPHER"))
            .contentType(MediaType.APPLICATION_JSON)
            .content(body)
            .with(xsrf()));
    }

    /**
     * 1.005 x 100.00 printed as 1.005 and 100.50 on the PDF, while the
     * NUMERIC(10,2) column stored 1.01 against the same 100.50 total.
     */
    @Test
    void quantityWithAThirdDecimalIsRejected() throws Exception {
        issueWithQuantity("1.005")
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.details.field").value("lineItems[0].quantity"));
        verify(invoiceService, never()).issueForBooking(any(), any(), any());
    }

    @Test
    void quantityTooLargeForTheColumnIsRejected() throws Exception {
        issueWithQuantity("123456789")
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void quantityWithTwoDecimalsIsAccepted() throws Exception {
        issueWithQuantity("1.25").andExpect(status().isOk());
        verify(invoiceService).issueForBooking(any(), any(), any());
    }
}
