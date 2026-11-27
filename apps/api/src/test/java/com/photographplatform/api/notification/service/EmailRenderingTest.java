package com.photographplatform.api.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.photographplatform.api.auth.service.EmailVerificationEmail;
import com.photographplatform.api.auth.service.PasswordResetEmail;
import com.photographplatform.api.auth.service.SignInCodeEmail;
import com.photographplatform.api.auth.service.StaffInvitationEmail;
import com.photographplatform.api.auth.service.StudioSignInCodesEmail;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.outbox.OutboxEntry;
import com.photographplatform.api.common.outbox.OutboxJob;
import com.photographplatform.api.common.outbox.Outbox;
import com.photographplatform.api.inquiry.service.InquiryDecisionEmail;
import com.photographplatform.api.messaging.application.GalleryExpiringMessage;
import com.photographplatform.api.messaging.application.GalleryReadyMessage;
import com.photographplatform.api.messaging.application.EnquiryReceivedMessage;
import com.photographplatform.api.messaging.domain.StudioIdentity;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpServerErrorException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Queue → JSON → render, for every email. The outbox stores a renderer's
 * inputs as JSON and renders them later, so an email whose inputs do not
 * survive the trip would be queued fine and fail at send time, every retry.
 */
class EmailRenderingTest {

    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-0000000000aa");

    /** Configured like Spring Boot's: java.time as ISO strings. */
    private static final ObjectMapper JSON = JsonMapper.builder()
        .findAndAddModules()
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
        .build();

    private static <T> T withBaseUrl(T renderer) {
        ReflectionTestUtils.setField(renderer, "webBaseUrl", "https://app.fotolio.de");
        return renderer;
    }

    static Stream<Object[]> everyEmail() {
        return Stream.of(
            new Object[] {new SignInCodeEmail(), new SignInCodeEmail.Params("Maria", "004182", 10)},
            new Object[] {new StudioSignInCodesEmail(), new StudioSignInCodesEmail.Params(List.of(
                new StudioSignInCodesEmail.StudioCode("Studio A", "111111"),
                new StudioSignInCodesEmail.StudioCode("Studio B", "222222")), 10)},
            new Object[] {new StudioSignInCodesEmail(), new StudioSignInCodesEmail.Params(List.of(), 10)},
            new Object[] {withBaseUrl(new PasswordResetEmail()), new PasswordResetEmail.Params("Anna", "tok")},
            new Object[] {withBaseUrl(new EmailVerificationEmail()), new EmailVerificationEmail.Params("Anna", "tok")},
            new Object[] {withBaseUrl(new StaffInvitationEmail()),
                new StaffInvitationEmail.Params("Studio A", "Anna", "tok")},
            new Object[] {new InquiryDecisionEmail(), new InquiryDecisionEmail.Params("Maria", true)},
            new Object[] {withBaseUrl(new LeadNotificationService(null)),
                new LeadNotificationService.Params(UUID.randomUUID(), "HIGH", "Maria", "maria@example.test")},
            new Object[] {new AutoReplyService(), new AutoReplyService.Params("Maria", "Studio Lichtblick")},
            new Object[] {new AutoReplyService(), new AutoReplyService.Params("Maria", null)},
            new Object[] {new EnquiryReceivedMessage(null, null, null, "https://app.fotolio.de"),
                new EnquiryReceivedMessage.Params(
                    StudioIdentity.resolve("Studio Lichtblick", "hallo@lichtblick.test", null, true,
                        "https://app.fotolio.de/api/public/studios/lichtblick/logo", "#AA3366"),
                    CustomerLanguage.EN, "Maria", "https://app.fotolio.de/p/lichtblick")},
            new Object[] {new EnquiryReceivedMessage(null, null, null, "https://app.fotolio.de"),
                new EnquiryReceivedMessage.Params(StudioIdentity.resolve(null, null, null, false, null, null),
                    CustomerLanguage.DE, null, null)},
            new Object[] {withBaseUrl(new InquiryNotificationService(null)),
                new InquiryNotificationService.Params(UUID.randomUUID(), "LOW", "Maria", "maria@example.test",
                    "HOCHZEIT", "OVER_2000", LocalDate.of(2027, 6, 12), "Berlin")},
            new Object[] {withBaseUrl(new ContractNotificationService(null)),
                new ContractNotificationService.Params(UUID.randomUUID(), UUID.randomUUID(), "Vertrag", "Maria")},
            new Object[] {new GalleryReadyMessage(null, null), new GalleryReadyMessage.Params(
                new StudioIdentity("Studio A", "hallo@studio-a.test", false, null, null), CustomerLanguage.DE,
                "Maria", "https://app.fotolio.de/g/anna-foto/acc", "Viel Freude <b>damit</b>")},
            new Object[] {new GalleryReadyMessage(null, null), new GalleryReadyMessage.Params(
                new StudioIdentity(null, null, false, null, null), CustomerLanguage.EN, null,
                "https://app.fotolio.de/g/anna-foto/acc", null)},
            new Object[] {new GalleryExpiringMessage(null, null), new GalleryExpiringMessage.Params(
                new StudioIdentity("Studio A", "hallo@studio-a.test", false, null, null), CustomerLanguage.DE,
                "Maria", "https://app.fotolio.de/g/anna-foto/acc",
                OffsetDateTime.of(2027, 1, 31, 12, 0, 0, 0, ZoneOffset.UTC), 5)},
            new Object[] {new GalleryExpiringMessage(null, null), new GalleryExpiringMessage.Params(
                new StudioIdentity(null, null, false, null, null), CustomerLanguage.EN, null,
                "https://app.fotolio.de/g/anna-foto/acc",
                OffsetDateTime.of(2027, 1, 31, 12, 0, 0, 0, ZoneOffset.UTC), 1)});
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("everyEmail")
    <P> void inputsSurviveTheQueueAndRenderTheSameEmail(EmailRenderer<P> renderer, P params) throws Exception {
        P restored = JSON.readValue(JSON.writeValueAsString(params), renderer.paramsType());

        RenderedEmail direct = renderer.render(params);
        RenderedEmail afterQueue = renderer.render(restored);

        assertThat(afterQueue).isEqualTo(direct);
        assertThat(direct.subject()).isNotBlank();
        assertThat(direct.htmlBody()).contains("<");
    }

    @Test
    void templateNamesAreUnique() {
        assertThat(everyEmail().map(e -> ((EmailRenderer<?>) e[0]).template()).distinct())
            .hasSize(everyEmail().map(e -> e[0].getClass()).distinct().toList().size());
    }

    // ── the façade and the handler, wired together over a fake outbox ──

    @SuppressWarnings("unchecked")
    private static EmailRenderers renderersOf(EmailRenderer<?>... renderers) {
        ObjectProvider<EmailRenderer<?>> provider = mock(ObjectProvider.class);
        when(provider.orderedStream()).thenAnswer(i -> Stream.of(renderers));
        return new EmailRenderers(provider);
    }

    @Test
    void queuedWithTheTypesPriorityAndDeliveredFromTheStoredRow() throws Exception {
        Outbox outbox = mock(Outbox.class);
        EmailSender sender = mock(EmailSender.class);
        EmailRenderers renderers = renderersOf(new SignInCodeEmail());
        EmailService service = new EmailService(sender, outbox, renderers, JSON);
        OffsetDateTime expires = OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(10);

        service.queue(new OutgoingEmail(SignInCodeEmail.TEMPLATE, "maria@example.test", TENANT,
            new SignInCodeEmail.Params("Maria", "123456", 10), null, expires));

        ArgumentCaptor<OutboxEntry> entry = ArgumentCaptor.forClass(OutboxEntry.class);
        verify(outbox).enqueue(entry.capture());
        assertThat(entry.getValue().priority()).isEqualTo(EmailType.LOGIN_CODE.priority());
        assertThat(entry.getValue().expiresAt()).isEqualTo(expires);
        assertThat(entry.getValue().recipientEmail()).isEqualTo("maria@example.test");
        assertThat(entry.getValue().payloadJson()).doesNotContain("<").doesNotContain("Your sign-in code");

        new EmailDeliveryHandler(service, renderers, JSON).handle(new OutboxJob(UUID.randomUUID(), "email",
            TENANT, entry.getValue().payloadJson(), "maria@example.test", 1, 1, expires));

        ArgumentCaptor<EmailMessage> sent = ArgumentCaptor.forClass(EmailMessage.class);
        verify(sender).send(sent.capture());
        assertThat(sent.getValue().subject()).isEqualTo("Your sign-in code: 123456");
        assertThat(sent.getValue().tenantId()).isEqualTo(TENANT);
    }

    @Test
    void theMessagesOwnSenderSurvivesTheQueueSoTheWorkerNeverLooksUpATenant() throws Exception {
        Outbox outbox = mock(Outbox.class);
        EmailSender sender = mock(EmailSender.class);
        EmailRenderers renderers = renderersOf(new SignInCodeEmail());
        EmailService service = new EmailService(sender, outbox, renderers, JSON);

        service.queue(new OutgoingEmail(SignInCodeEmail.TEMPLATE, "maria@example.test", TENANT,
            new SignInCodeEmail.Params("Maria", "123456", 10), null, null,
            "Atelier Müller", "hallo@atelier-mueller.test"));

        EmailMessage sent = deliverQueued(outbox, sender, service, renderers);
        assertThat(sent.fromName()).isEqualTo("Atelier Müller");
        assertThat(sent.replyTo()).isEqualTo("hallo@atelier-mueller.test");
    }

    @Test
    void anEmailQueuedWithoutASenderIsDeliveredWithout() throws Exception {
        Outbox outbox = mock(Outbox.class);
        EmailSender sender = mock(EmailSender.class);
        EmailRenderers renderers = renderersOf(new SignInCodeEmail());
        EmailService service = new EmailService(sender, outbox, renderers, JSON);

        service.queue(new OutgoingEmail(SignInCodeEmail.TEMPLATE, "maria@example.test", TENANT,
            new SignInCodeEmail.Params("Maria", "123456", 10), null, null));

        EmailMessage sent = deliverQueued(outbox, sender, service, renderers);
        assertThat(sent.fromName()).isNull();
        assertThat(sent.replyTo()).isNull();
    }

    @Test
    void aBlankReplyToIsQueuedAsNoneSoNoProviderRejectsTheMessage() throws Exception {
        Outbox outbox = mock(Outbox.class);
        EmailSender sender = mock(EmailSender.class);
        EmailRenderers renderers = renderersOf(new SignInCodeEmail());
        EmailService service = new EmailService(sender, outbox, renderers, JSON);

        service.queue(new OutgoingEmail(SignInCodeEmail.TEMPLATE, "maria@example.test", TENANT,
            new SignInCodeEmail.Params("Maria", "123456", 10), null, null, "Atelier Müller", "  "));

        assertThat(deliverQueued(outbox, sender, service, renderers).replyTo()).isNull();
        assertThat(new EmailMessage("a@example.test", "s", "b", EmailType.LOGIN_CODE, TENANT, null, "")
            .replyTo()).isNull();
    }

    @Test
    void aMessageWithoutItsOwnNameFallsBackToTheGlobalOne() {
        EmailMessage own = new EmailMessage("a@example.test", "s", "b", EmailType.INQUIRY_REPLY, TENANT,
            "Atelier Müller", null);
        EmailMessage none = new EmailMessage("a@example.test", "s", "b", EmailType.LOGIN_CODE, TENANT);
        EmailMessage blank = new EmailMessage("a@example.test", "s", "b", EmailType.LOGIN_CODE, TENANT, " ", null);

        assertThat(own.senderName("Fotolio")).isEqualTo("Atelier Müller");
        assertThat(none.senderName("Fotolio")).isEqualTo("Fotolio");
        assertThat(blank.senderName("Fotolio")).isEqualTo("Fotolio");
        assertThat(none.senderName(null)).isNull();
    }

    private static EmailMessage deliverQueued(Outbox outbox, EmailSender sender, EmailService service,
                                              EmailRenderers renderers) throws Exception {
        ArgumentCaptor<OutboxEntry> entry = ArgumentCaptor.forClass(OutboxEntry.class);
        verify(outbox).enqueue(entry.capture());
        new EmailDeliveryHandler(service, renderers, JSON).handle(new OutboxJob(UUID.randomUUID(), "email",
            TENANT, entry.getValue().payloadJson(), "maria@example.test", 1, 1, null));
        ArgumentCaptor<EmailMessage> sent = ArgumentCaptor.forClass(EmailMessage.class);
        verify(sender).send(sent.capture());
        return sent.getValue();
    }

    @Test
    void authEmailsJumpTheQueue() {
        assertThat(EmailType.LOGIN_CODE.priority()).isLessThan(EmailType.CONTRACT_SIGNED.priority());
        assertThat(EmailType.CONTRACT_SIGNED.priority()).isLessThan(EmailType.LEAD_NOTIFICATION.priority());
    }

    @Test
    void paramsOfTheWrongTypeAreRefusedWhenQueuedNotWhenSent() {
        EmailService service = new EmailService(
            mock(EmailSender.class), mock(Outbox.class), renderersOf(new SignInCodeEmail()), JSON);

        assertThatThrownBy(() -> service.queue(new OutgoingEmail(SignInCodeEmail.TEMPLATE, "a@example.test",
            TENANT, "not params", null, null))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.queue(new OutgoingEmail("no.such.template", "a@example.test",
            TENANT, "x", null, null))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aProviderFailureIsThrownForTheOutboxToRetryAndNamedByStatusOnly() {
        EmailSender sender = mock(EmailSender.class);
        when(sender.providerName()).thenReturn("test");
        HttpServerErrorException outage = new HttpServerErrorException(HttpStatus.SERVICE_UNAVAILABLE);
        org.mockito.Mockito.doThrow(outage).when(sender).send(org.mockito.ArgumentMatchers.any());
        EmailService service = new EmailService(sender, mock(Outbox.class), renderersOf(), JSON);
        EmailDeliveryHandler handler = new EmailDeliveryHandler(service, renderersOf(), JSON);

        assertThatThrownBy(() -> service.deliver(new EmailMessage("a@example.test", "s", "b",
            EmailType.LOGIN_CODE, TENANT))).isSameAs(outage);
        assertThat(handler.describeFailure(outage)).endsWith("status=503").doesNotContain("a@example.test");
    }
}
