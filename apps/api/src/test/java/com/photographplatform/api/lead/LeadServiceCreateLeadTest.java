package com.photographplatform.api.lead;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.dto.CreateLeadRequest;
import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.lead.repository.LeadRepository;
import com.photographplatform.api.lead.service.LeadResponseMapper;
import com.photographplatform.api.lead.service.LeadScoringService;
import com.photographplatform.api.lead.service.LeadService;
import com.photographplatform.api.messaging.application.CustomerMessageQueue;
import com.photographplatform.api.messaging.application.EnquiryReceivedMessage;
import com.photographplatform.api.notification.service.EmailService;
import com.photographplatform.api.notification.service.LeadNotificationService;
import com.photographplatform.api.portfolio.service.PortfolioPublication;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * What a new lead tells its listeners: where it came from (#103), and the
 * language the Customer reads (#127).
 */
class LeadServiceCreateLeadTest {

    private static final CreateLeadRequest REQUEST = new CreateLeadRequest("Maria", "maria@example.test", null,
        LocalDate.of(2027, 6, 12), "FAMILY", "OVER_1000", null, null, null);

    private final LeadRepository leadRepository = mock(LeadRepository.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final LeadService service = new LeadService(leadRepository, events, mock(AuditService.class),
        userRepository, mock(LeadScoringService.class), mock(LeadResponseMapper.class));

    LeadServiceCreateLeadTest() {
        when(leadRepository.save(any(Lead.class))).thenAnswer(i -> i.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static CreateLeadRequest withLanguage(String language) {
        return new CreateLeadRequest(REQUEST.name(), REQUEST.email(), REQUEST.phone(), REQUEST.eventDate(),
            REQUEST.eventType(), REQUEST.budgetRange(), REQUEST.message(), REQUEST.website(), language);
    }

    private LeadCreatedEvent published() {
        ArgumentCaptor<LeadCreatedEvent> event = ArgumentCaptor.forClass(LeadCreatedEvent.class);
        verify(events).publishEvent(event.capture());
        return event.getValue();
    }

    @Test
    void aPublicLeadCarriesItsOriginAndTheLanguageTheFormWasIn() {
        service.createLead(withLanguage("en"), new Tenant("anna-foto", "anna@example.test"), "203.0.113.7");

        LeadCreatedEvent event = published();
        assertThat(event.getOrigin()).isEqualTo(LeadCreatedEvent.Origin.PUBLIC_FORM);
        assertThat(event.getLanguage()).isEqualTo(CustomerLanguage.EN);
        assertThat(event.getPhotographerEmail()).isEqualTo("anna@example.test");
    }

    @Test
    void aPublicLeadWithoutALanguageIsGerman() {
        service.createLead(REQUEST, new Tenant("anna-foto", "anna@example.test"), "203.0.113.7");

        assertThat(published().getLanguage()).isEqualTo(CustomerLanguage.DE);
    }

    @Test
    void aLeadTheStudioTypedInCarriesItsLanguageToo() {
        typeInALead();

        assertThat(published().getLanguage()).isEqualTo(CustomerLanguage.DE);
    }

    @Test
    void aLeadTheStudioTypedInSaysSo() {
        typeInALead();

        assertThat(published().getOrigin()).isEqualTo(LeadCreatedEvent.Origin.ENTERED_BY_STUDIO);
    }

    @Test
    void aLeadTheStudioTypedInQueuesNoEmailToAnyone() {
        typeInALead();
        EmailService emailService = mock(EmailService.class);

        LeadCreatedEvent event = published();
        CustomerMessageQueue customerMessages = mock(CustomerMessageQueue.class);
        PublicTenantResolver tenants = mock(PublicTenantResolver.class);
        new EnquiryReceivedMessage(customerMessages, tenants, mock(PortfolioPublication.class),
            "https://app.fotolio.de").onLeadCreated(event);
        new LeadNotificationService(emailService).onLeadCreated(event);

        verifyNoInteractions(emailService, customerMessages, tenants);
    }

    private void typeInALead() {
        UUID actorId = UUID.randomUUID();
        User actor = mock(User.class);
        when(actor.getTenantId()).thenReturn(UUID.randomUUID());
        when(actor.getEmail()).thenReturn("anna@example.test");
        when(userRepository.findById(actorId)).thenReturn(Optional.of(actor));
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(actorId.toString(), null));

        service.createLeadByPhotographer(REQUEST, "203.0.113.7");
    }
}
