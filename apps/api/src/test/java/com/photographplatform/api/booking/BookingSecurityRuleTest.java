package com.photographplatform.api.booking;

import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.controller.BookingController;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingService;
import com.photographplatform.api.common.config.SecurityConfig;
import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.security.TenantContextFilter;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;
import static com.photographplatform.api.common.CsrfTestSupport.xsrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Fast (no-Docker) verification of the booking authorization rules in
 * {@link SecurityConfig}. Drives the real security filter chain with genuine
 * signed JWTs, so it proves the role gate end-to-end at the web layer.
 *
 * <p>Threat model: a customer logs in legitimately (CUSTOMER tokens are minted
 * by {@code CustomerAuthService}, scoped to the photographer's tenant) and then
 * points that valid token at the photographer's booking-management API. A 403 —
 * not a 401 — confirms the token authenticated but was denied on role. The
 * customer's own bookings endpoint must stay reachable.
 */
@WebMvcTest(BookingController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, TenantContextFilter.class, JwtService.class})
class BookingSecurityRuleTest {

    private static final UUID TENANT_ID = UUID.randomUUID();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private BookingService bookingService;

    @MockitoBean
    private BookingRepository bookingRepository;

    @MockitoBean
    private UserRepository userRepository;

    private String customerToken() {
        return jwtService.generateToken(UUID.randomUUID(), TENANT_ID, "CUSTOMER");
    }

    private String photographerToken() {
        return jwtService.generateToken(UUID.randomUUID(), TENANT_ID, "PHOTOGRAPHER");
    }

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
    void customerTokenIsForbiddenFromPhotographerBookings() throws Exception {
        mvc.perform(get("/api/photographerBookings")
                .header("Authorization", "Bearer " + customerToken()))
            .andExpect(status().isForbidden());
    }

    @Test
    void customerTokenIsForbiddenFromCreatingBookings() throws Exception {
        mvc.perform(post("/api/bookings")
                .header("Authorization", "Bearer " + customerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"clientName\":\"A\",\"clientEmail\":\"a@b.com\",\"eventDate\":\"%s\"}"
                    .formatted(java.time.LocalDate.now().plusDays(30)))
                .with(xsrf()))
            .andExpect(status().isForbidden());
    }

    @Test
    void customerTokenIsForbiddenFromChangingStatus() throws Exception {
        mvc.perform(patch("/api/bookings/" + UUID.randomUUID() + "/status")
                .header("Authorization", "Bearer " + customerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CONFIRMED\"}")
                .with(xsrf()))
            .andExpect(status().isForbidden());
    }

    /** The customer's own bookings endpoint must remain reachable by a CUSTOMER. */
    @Test
    void customerTokenIsAllowedIntoOwnBookings() throws Exception {
        when(bookingService.getOwnBookings(nullable(String.class), anyInt(), anyInt()))
            .thenReturn(List.of());
        mvc.perform(get("/api/customerBookings")
                .header("Authorization", "Bearer " + customerToken()))
            .andExpect(status().isOk());
    }

    @Test
    void photographerTokenIsAllowedIntoPhotographerBookings() throws Exception {
        when(bookingRepository.findByOrderByEventDateAsc(any())).thenReturn(Page.empty());
        mvc.perform(get("/api/photographerBookings")
                .header("Authorization", "Bearer " + photographerToken()))
            .andExpect(status().isOk());
    }

    @Test
    void unauthenticatedIsDeniedFromPhotographerBookings() throws Exception {
        mvc.perform(get("/api/photographerBookings"))
            .andExpect(status().is4xxClientError());
    }

    /**
     * A booking is scheduled work, so it cannot be created in the past —
     * {@code @FutureOrPresent} on {@code CreateBookingRequest.eventDate}. Note
     * this covers creation only: {@code UpdateBookingRequest} deliberately
     * carries no such rule, because a shoot that already happened still needs
     * to be priced and annotated afterwards.
     */
    @Test
    void pastEventDateIsRejectedOnCreate() throws Exception {
        String pastBody = """
            {"clientName":"A","clientEmail":"a@b.com","eventDate":"%s"}
            """.formatted(java.time.LocalDate.now().minusDays(1));

        mvc.perform(post("/api/bookings")
                .header("Authorization", "Bearer " + photographerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(pastBody)
                .with(xsrf()))
            .andExpect(status().isUnprocessableEntity());
    }
}
