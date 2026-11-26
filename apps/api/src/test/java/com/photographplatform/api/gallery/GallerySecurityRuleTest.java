package com.photographplatform.api.gallery;

import static com.photographplatform.api.common.CsrfTestSupport.xsrf;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.gallery.controller.GalleryController;
import com.photographplatform.api.gallery.service.GalleryArchiveWriter;
import com.photographplatform.api.gallery.service.GalleryService;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
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
 * The positive direction for "An Kunden senden" on a gallery: the studio's
 * staff get through, with or without a personal note. That a CUSTOMER is
 * refused is asserted for every staff route at once by
 * {@code EndpointRoleMatrixIT}; it is repeated here because this route emails
 * a Customer in the studio's name, which is the one thing a Customer must not
 * be able to make it do.
 */
@WebMvcTest(GalleryController.class)
@Import({
    SecurityConfig.class, RestAuthEntryPoints.class, ClockConfig.class,
    JwtAuthFilter.class, TenantContextFilter.class, JwtService.class
})
class GallerySecurityRuleTest {

    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID GALLERY_ID = UUID.randomUUID();
    private static final String SEND = "/api/galleries/" + GALLERY_ID + "/send";

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;

    @MockitoBean private GalleryService galleryService;
    @MockitoBean private PublicTenantResolver tenantResolver;
    @MockitoBean private GalleryArchiveWriter archiveWriter;
    /** Needed by the interceptors {@code @WebMvcTest} picks up; see InquirySecurityRuleTest. */
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
    void thePhotographerCanSendWithANote() throws Exception {
        mvc.perform(post(SEND)
                .header("Authorization", bearer("PHOTOGRAPHER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"note\":\"Viel Freude!\"}").with(xsrf()))
            .andExpect(status().isOk());

        verify(galleryService).send(eq(GALLERY_ID), eq("Viel Freude!"), nullable(String.class));
    }

    @Test
    void anAdminCanSendWithoutABody() throws Exception {
        mvc.perform(post(SEND)
                .header("Authorization", bearer("ADMIN"))
                .with(xsrf()))
            .andExpect(status().isOk());

        verify(galleryService).send(eq(GALLERY_ID), isNull(), nullable(String.class));
    }

    @Test
    void aCustomerCannotSend() throws Exception {
        mvc.perform(post(SEND)
                .header("Authorization", bearer("CUSTOMER"))
                .with(xsrf()))
            .andExpect(status().isForbidden());

        verify(galleryService, never()).send(any(), nullable(String.class), nullable(String.class));
    }

    @Test
    void aNoteOverAThousandCharactersIsRejectedBeforeAnythingRuns() throws Exception {
        mvc.perform(post(SEND)
                .header("Authorization", bearer("PHOTOGRAPHER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"note\":\"" + "a".repeat(1001) + "\"}").with(xsrf()))
            .andExpect(status().isUnprocessableEntity());

        verify(galleryService, never()).send(any(), anyString(), nullable(String.class));
    }

    @Test
    void anEmptyGalleryAnswersConflict() throws Exception {
        when(galleryService.send(eq(GALLERY_ID), isNull(), nullable(String.class)))
            .thenThrow(new ConflictException("Upload photos before sending this gallery to the customer"));

        mvc.perform(post(SEND)
                .header("Authorization", bearer("PHOTOGRAPHER"))
                .with(xsrf()))
            .andExpect(status().isConflict());
    }

    private String bearer(String role) {
        return "Bearer " + jwtService.generateToken(UUID.randomUUID(), TENANT_ID, role);
    }
}
