package com.photographplatform.api.notification.service;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.lead.event.LeadCreatedEvent.Origin;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * The studio's alert about a new lead: its silence for a lead the studio typed
 * in (#103), and what it says, in the recipient's language (#126).
 */
class LeadNotificationServiceTest {

    private static final LeadCreatedEvent.Details DETAILS =
        new LeadCreatedEvent.Details(LocalDate.of(2027, 6, 12), "WEDDING", "Wir heiraten im Juni.");

    private final EmailService emailService = mock(EmailService.class);
    private final LeadNotificationService service = new LeadNotificationService(emailService);

    private static LeadCreatedEvent lead(Origin origin) {
        return origin == Origin.PUBLIC_FORM
            ? LeadCreatedEvent.fromPublicForm(new Object(), UUID.randomUUID(), UUID.randomUUID(), "Maria",
                "maria@example.test", "MED", DETAILS, CustomerLanguage.DE, "anna@example.test", CustomerLanguage.EN)
            : LeadCreatedEvent.enteredByStudio(new Object(), UUID.randomUUID(), UUID.randomUUID(), "Maria",
                "maria@example.test", "MED", DETAILS, CustomerLanguage.DE, "anna@example.test", CustomerLanguage.EN);
    }

    private static RenderedEmail render(CustomerLanguage language, String message) {
        LeadNotificationService renderer = new LeadNotificationService(null);
        ReflectionTestUtils.setField(renderer, "webBaseUrl", "https://app.fotolio.de");
        return renderer.render(new LeadNotificationService.Params(UUID.randomUUID(), "HIGH", "Maria",
            "maria@example.test", LocalDate.of(2027, 6, 12), "WEDDING", message, language));
    }

    @Test
    void aLeadFromThePublicFormAlertsThePhotographer() {
        service.onLeadCreated(lead(Origin.PUBLIC_FORM));

        ArgumentCaptor<OutgoingEmail> queued = ArgumentCaptor.forClass(OutgoingEmail.class);
        verify(emailService).queue(queued.capture());
        assertThat(queued.getValue().to()).isEqualTo("anna@example.test");
    }

    @Test
    void theAlertCarriesWhatTheCustomerAskedForInThePhotographersLanguage() {
        service.onLeadCreated(lead(Origin.PUBLIC_FORM));

        ArgumentCaptor<OutgoingEmail> queued = ArgumentCaptor.forClass(OutgoingEmail.class);
        verify(emailService).queue(queued.capture());
        LeadNotificationService.Params params = (LeadNotificationService.Params) queued.getValue().params();
        assertThat(params.eventDate()).isEqualTo(LocalDate.of(2027, 6, 12));
        assertThat(params.eventType()).isEqualTo("WEDDING");
        assertThat(params.message()).isEqualTo("Wir heiraten im Juni.");
        // The photographer's language, not the Customer's (DE on the event).
        assertThat(params.language()).isEqualTo(CustomerLanguage.EN);
    }

    @Test
    void whoeverTypedALeadInIsNotAlertedAboutIt() {
        service.onLeadCreated(lead(Origin.ENTERED_BY_STUDIO));

        verifyNoInteractions(emailService);
    }

    @Test
    void germanShowsDateTypeAndMessage() {
        RenderedEmail email = render(CustomerLanguage.DE, "Wir heiraten im Juni.");

        assertThat(email.subject()).isEqualTo("🟢 Neuer Lead mit hoher Priorität — Maria");
        assertThat(email.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Neue Buchungsanfrage")
            .contains("Hohe Priorität")
            .contains("12. Juni 2027")
            .contains("Hochzeit")
            .contains("Wir heiraten im Juni.")
            .contains("Im Dashboard öffnen")
            .doesNotContain("New booking inquiry").doesNotContain("Wedding");
    }

    @Test
    void englishShowsDateTypeAndMessage() {
        RenderedEmail email = render(CustomerLanguage.EN, "We are getting married in June.");

        assertThat(email.subject()).isEqualTo("🟢 New high-value lead — Maria");
        assertThat(email.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("New booking inquiry")
            .contains("High priority")
            .contains("12 Jun 2027")
            .contains("Wedding")
            .contains("We are getting married in June.")
            .contains("Open in dashboard")
            .doesNotContain("Buchungsanfrage").doesNotContain("Hochzeit");
    }

    @Test
    void theMessageIsEscapedAndKeepsItsLineBreaks() {
        RenderedEmail email = render(CustomerLanguage.DE, "<script>alert(1)</script>\nZweite Zeile");

        assertThat(email.htmlBody())
            .contains("&lt;script&gt;alert(1)&lt;/script&gt;<br>Zweite Zeile")
            .doesNotContain("<script>");
    }

    @Test
    void noMessageNoMessageBlock() {
        RenderedEmail email = render(CustomerLanguage.DE, "  ");

        assertThat(email.htmlBody()).doesNotContain("Nachricht");
    }

    @Test
    void aJobQueuedBeforeTheLanguageExistedRendersInGerman() {
        RenderedEmail email = render(null, null);

        assertThat(email.htmlBody()).contains("<html lang=\"de\"").contains("Neue Buchungsanfrage");
    }
}
