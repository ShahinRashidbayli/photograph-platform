package com.photographplatform.api.gallery;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import com.photographplatform.api.gallery.controller.CustomerGalleryController;
import com.photographplatform.api.gallery.service.CustomerGalleryService;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The positive direction for the portal's gallery list: a CUSTOMER token gets
 * through. That every other role is refused is asserted for all routes at once
 * by {@code EndpointRoleMatrixIT}; the photographer case is repeated here only
 * because it is the one that would matter — the studio has its own list.
 */
@WebMvcTest(CustomerGalleryController.class)
@Import({
    SecurityConfig.class, RestAuthEntryPoints.class, ClockConfig.class,
    JwtAuthFilter.class, TenantContextFilter.class, JwtService.class
})
class CustomerGallerySecurityRuleTest {

    private static final UUID TENANT_ID = UUID.randomUUID();

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private CustomerGalleryService customerGalleryService;

    /** Needed by the interceptors {@code @WebMvcTest} picks up; see InquirySecurityRuleTest. */
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

    @BeforeEach
    void assumeALiveSession() {
        when(tokenRevocationCheck.isTokenStillValid(any(), any())).thenReturn(true);
    }

    private String token(String role) {
        return jwtService.generateToken(UUID.randomUUID(), TENANT_ID, role);
    }

    @Test
    void customerCanListOwnGalleries() throws Exception {
        when(customerGalleryService.listForCustomer()).thenReturn(List.of());

        mvc.perform(get("/api/customer/galleries")
                .header("Authorization", "Bearer " + token("CUSTOMER")))
            .andExpect(status().isOk());
    }

    @Test
    void photographerTokenIsForbidden() throws Exception {
        mvc.perform(get("/api/customer/galleries")
                .header("Authorization", "Bearer " + token("PHOTOGRAPHER")))
            .andExpect(status().isForbidden());
    }
}
