package com.photographplatform.api.notification.service;

import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.lead.event.LeadCreatedEvent.Origin;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/** The studio's alert about a new lead, and its silence for a lead the studio typed in (#103). */
class LeadNotificationServiceTest {

    private final EmailService emailService = mock(EmailService.class);
    private final LeadNotificationService service = new LeadNotificationService(emailService);

    private static LeadCreatedEvent lead(Origin origin) {
        return origin == Origin.PUBLIC_FORM
            ? LeadCreatedEvent.fromPublicForm(new Object(), UUID.randomUUID(), UUID.randomUUID(), "Maria",
                "maria@example.test", "MED", "Studio Lichtblick", "anna@example.test")
            : LeadCreatedEvent.enteredByStudio(new Object(), UUID.randomUUID(), UUID.randomUUID(), "Maria",
                "maria@example.test", "MED", "anna@example.test");
    }

    @Test
    void aLeadFromThePublicFormAlertsThePhotographer() {
        service.onLeadCreated(lead(Origin.PUBLIC_FORM));

        ArgumentCaptor<OutgoingEmail> queued = ArgumentCaptor.forClass(OutgoingEmail.class);
        verify(emailService).queue(queued.capture());
        assertThat(queued.getValue().to()).isEqualTo("anna@example.test");
    }

    @Test
    void whoeverTypedALeadInIsNotAlertedAboutIt() {
        service.onLeadCreated(lead(Origin.ENTERED_BY_STUDIO));

        verifyNoInteractions(emailService);
    }
}
