package com.photographplatform.api.notification.service;

import com.fasterxml.jackson.databind.json.JsonMapper;
import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.lead.event.LeadCreatedEvent.Origin;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * The acknowledgement a Customer gets after the public request form (#103):
 * in the studio's name, promising nothing, and never for a lead the studio
 * typed in itself.
 */
class AutoReplyServiceTest {

    private static final UUID LEAD = UUID.fromString("00000000-0000-0000-0000-00000000000a");
    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-0000000000aa");

    private final EmailService emailService = mock(EmailService.class);
    private final AutoReplyService service = new AutoReplyService(emailService);

    private static LeadCreatedEvent lead(Origin origin, String studioName) {
        return lead("HIGH", origin, studioName);
    }

    private static LeadCreatedEvent lead(String score, Origin origin, String studioName) {
        return new LeadCreatedEvent(new Object(), LEAD, TENANT, "Maria", "maria@example.test", score,
            origin, studioName, "anna@example.test");
    }

    private RenderedEmail queuedAndRendered(LeadCreatedEvent event) {
        service.onLeadCreated(event);
        ArgumentCaptor<OutgoingEmail> queued = ArgumentCaptor.forClass(OutgoingEmail.class);
        verify(emailService).queue(queued.capture());
        return service.render((AutoReplyService.Params) queued.getValue().params());
    }

    // HIGH once meant wedding copy with packages for every event type (#103).
    // The event type never reaches the email, so the score is the only lever left.
    @ParameterizedTest
    @ValueSource(strings = {"HIGH", "MED", "LOW"})
    void everyScoreGetsTheSameNeutralAcknowledgement(String score) {
        RenderedEmail email = queuedAndRendered(lead(score, Origin.PUBLIC_FORM, "Studio Lichtblick"));

        assertThat(email.subject()).isEqualTo("Ihre Anfrage bei Studio Lichtblick");
        assertThat(email.htmlBody())
            .contains("Studio Lichtblick")
            .doesNotContain("€", "Paket", "Stunden", "Hochzeit", "Erfahrung", "/p/");
    }

    @Test
    void aLeadFromThePublicFormIsAcknowledgedInTheStudiosName() {
        service.onLeadCreated(lead(Origin.PUBLIC_FORM, "Studio Lichtblick"));

        ArgumentCaptor<OutgoingEmail> queued = ArgumentCaptor.forClass(OutgoingEmail.class);
        verify(emailService).queue(queued.capture());
        assertThat(queued.getValue().to()).isEqualTo("maria@example.test");
        assertThat(queued.getValue().params()).isEqualTo(new AutoReplyService.Params("Maria", "Studio Lichtblick"));
        assertThat(queued.getValue().idempotencyKey()).isEqualTo("LEAD_AUTO_REPLY:" + LEAD);
    }

    @Test
    void aLeadTheStudioTypedInGetsNoAcknowledgement() {
        service.onLeadCreated(lead(Origin.ENTERED_BY_STUDIO, null));

        verifyNoInteractions(emailService);
    }

    @Test
    void itPromisesNothingTheStudioDidNotSay() {
        RenderedEmail email = service.render(new AutoReplyService.Params("Maria", "Studio Lichtblick"));

        assertThat(email.subject()).isEqualTo("Ihre Anfrage bei Studio Lichtblick");
        assertThat(email.htmlBody())
            .contains("Studio Lichtblick", "Hallo Maria,")
            .doesNotContain("€", "Paket", "Stunden", "Hochzeit", "Erfahrung", "/p/", "melden uns");
    }

    @Test
    void withoutAStudioNameItStaysNeutralInsteadOfInventingOne() {
        RenderedEmail email = service.render(new AutoReplyService.Params("Maria", null));

        assertThat(email.subject()).isEqualTo("Ihre Anfrage ist eingegangen");
        assertThat(email.htmlBody()).doesNotContain("null", "Ihr Fotograf");
    }

    @Test
    void namesTypedIntoThePublicFormAreEscaped() {
        RenderedEmail email = service.render(new AutoReplyService.Params("<b>Maria</b>", "A & B <i>"));

        assertThat(email.htmlBody())
            .contains("&lt;b&gt;Maria&lt;/b&gt;", "A &amp; B &lt;i&gt;")
            .doesNotContain("<b>Maria</b>", "<i>");
    }

    @Test
    void aRowQueuedBeforeTheFixStillRendersWithoutTheInventedOffer() throws Exception {
        // Strict mapper: fails on unknown fields unless Params says otherwise.
        String oldRow = "{\"score\":\"HIGH\",\"clientName\":\"Maria\",\"photographerSubdomain\":\"anna-foto\"}";

        AutoReplyService.Params params = JsonMapper.builder().build().readValue(oldRow, AutoReplyService.Params.class);
        RenderedEmail email = service.render(params);

        assertThat(params).isEqualTo(new AutoReplyService.Params("Maria", null));
        assertThat(email.htmlBody()).doesNotContain("Anna Foto", "€", "Hochzeit");
    }
}
