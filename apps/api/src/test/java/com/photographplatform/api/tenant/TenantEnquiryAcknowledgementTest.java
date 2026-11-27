package com.photographplatform.api.tenant;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.dto.EnquiryAcknowledgementSetting;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.tenant.service.TenantSettingsService;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** The studio's switch for the automatic enquiry acknowledgement, and its audit trail. */
class TenantEnquiryAcknowledgementTest {

    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID ACTOR_ID = UUID.randomUUID();

    private final TenantRepository tenantRepository = mock(TenantRepository.class);
    private final AuditService auditService = mock(AuditService.class);
    private final TenantSettingsService service = new TenantSettingsService(tenantRepository, auditService);
    private final Tenant tenant = new Tenant("lichtblick", "anna@example.test");

    @BeforeEach
    void setUp() {
        TenantContext.setTenant(TENANT_ID.toString());
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(ACTOR_ID.toString(), null));
        when(tenantRepository.require(TENANT_ID)).thenReturn(tenant);
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(i -> i.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void aNewStudioAcknowledgesEnquiries() {
        assertThat(service.getEnquiryAcknowledgement().enabled()).isTrue();
    }

    @Test
    void switchingItOffIsStoredAndAudited() {
        EnquiryAcknowledgementSetting result =
            service.updateEnquiryAcknowledgement(new EnquiryAcknowledgementSetting(false), "203.0.113.7");

        assertThat(result.enabled()).isFalse();
        assertThat(tenant.isEnquiryAcknowledgementEnabled()).isFalse();
        verify(tenantRepository).save(tenant);
        verify(auditService).logChange("TENANT_ENQUIRY_ACKNOWLEDGEMENT_UPDATED", "TENANT", TENANT_ID, TENANT_ID,
            ACTOR_ID, "203.0.113.7", "true", "false");
    }

    /** Saving the form unchanged is not a change worth an audit row. */
    @Test
    void savingTheSameValueAgainChangesAndAuditsNothing() {
        service.updateEnquiryAcknowledgement(new EnquiryAcknowledgementSetting(true), "203.0.113.7");

        assertThat(tenant.isEnquiryAcknowledgementEnabled()).isTrue();
        verifyNoInteractions(auditService);
    }
}
