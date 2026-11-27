package com.photographplatform.api.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingQueryService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.contract.domain.Contract;
import com.photographplatform.api.contract.event.ContractSentEvent;
import com.photographplatform.api.contract.repository.ContractRepository;
import com.photographplatform.api.contract.service.ContractPdfRenderer;
import com.photographplatform.api.contract.service.ContractService;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * What a send and a resend tell the Customer and the audit trail. The note
 * reaches the Customer through the event; the audit row only says one was sent.
 */
class ContractSendTest {

    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID BOOKING_ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-11-26T10:15:30Z");
    private static final String NOTE = "Bis Freitag bitte! <b>Danke</b>";

    private final ContractRepository contracts = mock(ContractRepository.class);
    private final TenantRepository tenants = mock(TenantRepository.class);
    private final BookingQueryService bookings = mock(BookingQueryService.class);
    private final AuditService audit = mock(AuditService.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private ContractService service;
    private Contract contract;

    @BeforeEach
    void setUp() {
        service = new ContractService(contracts, mock(BookingRepository.class), bookings, tenants,
            mock(UserRepository.class), mock(EntitlementService.class), mock(ContractPdfRenderer.class), audit,
            events, Clock.fixed(NOW, ZoneOffset.UTC));
        contract = new Contract(TENANT_ID, BOOKING_ID, "Vertrag", "Text", "Emma Clarke", "emma@example.test");
        when(contracts.findByIdAndTenantId(any(), eq(TENANT_ID))).thenReturn(Optional.of(contract));
        Tenant tenant = new Tenant("lichtblick", "anna@example.test");
        tenant.setLegalName("Anna Müller");
        when(tenants.findById(TENANT_ID)).thenReturn(Optional.of(tenant));
        when(bookings.customerLanguage(BOOKING_ID)).thenReturn(CustomerLanguage.EN);

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(USER_ID.toString(), null, List.of()));
        TenantContext.setTenant(TENANT_ID.toString());
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void sendingPublishesWhatTheCustomerMessageNeeds() {
        service.send(contract.getId(), "  " + NOTE + "  ", "203.0.113.5");

        ContractSentEvent event = published();
        assertThat(event.getBookingId()).isEqualTo(BOOKING_ID);
        assertThat(event.getTenantId()).isEqualTo(TENANT_ID);
        assertThat(event.getRecipientEmail()).isEqualTo("emma@example.test");
        assertThat(event.getRecipientName()).isEqualTo("Emma Clarke");
        assertThat(event.getLanguage()).isEqualTo(CustomerLanguage.EN);
        assertThat(event.getPersonalNote()).isEqualTo(NOTE);
        assertThat(event.getSentAt()).isEqualTo(NOW);
    }

    @Test
    void theAuditRowSaysANoteWasSentButNotWhatItSaid() {
        service.send(contract.getId(), NOTE, "203.0.113.5");

        ArgumentCaptor<String> oldValue = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> newValue = ArgumentCaptor.forClass(String.class);
        verify(audit).logChange(eq("CONTRACT_SENT"), eq("CONTRACT"), any(), eq(TENANT_ID), eq(USER_ID),
            eq("203.0.113.5"), oldValue.capture(), newValue.capture());
        assertThat(newValue.getValue()).isEqualTo(ContractService.SENT_WITH_A_NOTE);
        assertThat(oldValue.getValue()).isNull();
        assertThat(newValue.getValue()).doesNotContain("Freitag");
    }

    @Test
    void aResendWithANoteIsAuditedTheSameWay() {
        service.send(contract.getId(), null, null);

        service.resend(contract.getId(), NOTE, null);

        verify(audit).logChange(eq("CONTRACT_RESENT"), eq("CONTRACT"), any(), eq(TENANT_ID), eq(USER_ID),
            isNull(), isNull(), eq(ContractService.SENT_WITH_A_NOTE));
    }

    @Test
    void withoutANoteTheAuditRowIsPlain() {
        service.send(contract.getId(), "   ", null);

        verify(audit).logQuietly(eq("CONTRACT_SENT"), eq("CONTRACT"), any(), eq(TENANT_ID), eq(USER_ID), isNull());
        verify(audit, never()).logChange(anyString(), anyString(), any(), any(), any(), any(), any(), any());
        assertThat(published().getPersonalNote()).isNull();
    }

    @Test
    void aResendLeavesTheContractAsItWas() {
        service.send(contract.getId(), null, null);
        OffsetDateTime sentAt = contract.getSentAt();

        service.resend(contract.getId(), null, null);

        assertThat(contract.getSentAt()).isEqualTo(sentAt);
        assertThat(contract.getStatus().name()).isEqualTo("SENT");
    }

    @Test
    void resendingADraftIsAConflictAndTellsNobody() {
        assertThatThrownBy(() -> service.resend(contract.getId(), null, null))
            .isInstanceOf(ConflictException.class);
        verify(events, never()).publishEvent(any(ApplicationEvent.class));
    }

    private ContractSentEvent published() {
        ArgumentCaptor<ApplicationEvent> captor = ArgumentCaptor.forClass(ApplicationEvent.class);
        verify(events).publishEvent(captor.capture());
        return (ContractSentEvent) captor.getValue();
    }
}
