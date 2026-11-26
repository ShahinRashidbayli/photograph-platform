package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.config.EmailProperties;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Spring Boot only builds a {@code JavaMailSender} when {@code
 * spring.mail.host} is set, so naming smtp without a host leaves the transport
 * bean unsatisfiable. Left alone, that surfaces as a
 * NoSuchBeanDefinitionException for a bean the operator never asked for —
 * accurate and useless. The sender reports the missing host itself, at boot,
 * rather than at the first magic link nobody receives.
 */
class SmtpEmailSenderTest {

    private static final EmailProperties PROPS = new EmailProperties(
        "smtp", "noreply@fotolio.de", "Fotolio", null, null);

    @Test
    void refusesToStartWithoutAMailHost() {
        SmtpEmailSender sender = new SmtpEmailSender(emptyProvider(), PROPS);

        assertThatThrownBy(sender::requireMailHost)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("SPRING_MAIL_HOST")
            .hasMessageContaining("EMAIL_PROVIDER=none");
    }

    @Test
    void startsWhenAMailHostIsConfigured() {
        SmtpEmailSender sender = new SmtpEmailSender(providerOf(mock(JavaMailSender.class)), PROPS);

        assertThatCode(sender::requireMailHost).doesNotThrowAnyException();
    }

    @Test
    void stampsTheConfiguredSenderIdentityAndSendsHtml() throws Exception {
        JavaMailSender mail = mock(JavaMailSender.class);
        MimeMessage mime = new MimeMessage(Session.getInstance(new Properties()));
        when(mail.createMimeMessage()).thenReturn(mime);

        new SmtpEmailSender(providerOf(mail), PROPS)
            .send(new EmailMessage("kunde@example.test", "Ihre Rechnung", "<p>Grüße</p>",
                EmailType.INQUIRY_REPLY, UUID.randomUUID()));

        ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mail).send(sent.capture());
        MimeMessage out = sent.getValue();

        // The from address is stamped by the transport, never by the caller —
        // see EmailMessage.
        assertThat(out.getFrom()[0].toString()).contains("noreply@fotolio.de").contains("Fotolio");
        assertThat(out.getAllRecipients()[0].toString()).isEqualTo("kunde@example.test");
        assertThat(out.getSubject()).isEqualTo("Ihre Rechnung");

        // Assert on what actually goes over the wire. getContentType() before
        // saveChanges() reports the unset default, so checking it here would be
        // testing the mock rather than the message.
        ByteArrayOutputStream wire = new ByteArrayOutputStream();
        out.writeTo(wire);
        String raw = wire.toString(StandardCharsets.UTF_8);
        assertThat(raw).contains("text/html");
        assertThat(raw).as("the umlaut must survive the transfer encoding")
            .satisfiesAnyOf(
                r -> assertThat(r).contains("Grüße"),
                r -> assertThat(r).containsIgnoringCase("utf-8"));
    }

    @Test
    void sendsUnderTheMessagesOwnNameWithItsReplyTo() throws Exception {
        MimeMessage out = sendThroughSmtp(new EmailMessage("kunde@example.test", "Ihre Galerie", "<p>Hallo</p>",
            EmailType.INQUIRY_REPLY, UUID.randomUUID(), "Müller, Fotografie", "hallo@mueller.test"));

        InternetAddress from = (InternetAddress) out.getFrom()[0];
        assertThat(from.getAddress()).isEqualTo("noreply@fotolio.de");
        assertThat(from.getPersonal()).isEqualTo("Müller, Fotografie");
        assertThat(out.getReplyTo()).extracting(a -> ((InternetAddress) a).getAddress())
            .containsExactly("hallo@mueller.test");
    }

    @Test
    void withoutItsOwnNameSendsAsFotolioWithNoReplyTo() throws Exception {
        MimeMessage out = sendThroughSmtp(new EmailMessage("kunde@example.test", "Ihr Code", "<p>1</p>",
            EmailType.LOGIN_CODE, UUID.randomUUID()));

        assertThat(((InternetAddress) out.getFrom()[0]).getPersonal()).isEqualTo("Fotolio");
        assertThat(out.getHeader("Reply-To")).isNull();
    }

    /** BUG-014: a log line is not a place for anything a Customer or studio wrote. */
    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void theLogNamesNeitherRecipientNorSubjectNorReplyTo(CapturedOutput log) throws Exception {
        sendThroughSmtp(new EmailMessage("kunde@example.test", "Ihre Galerie", "<p>Hallo</p>",
            EmailType.INQUIRY_REPLY, UUID.randomUUID(), "Atelier Müller", "hallo@mueller.test"));

        assertThat(log.getAll()).contains("Email sent provider=smtp")
            .doesNotContain("kunde@example.test")
            .doesNotContain("Ihre Galerie")
            .doesNotContain("hallo@mueller.test");
    }

    private static MimeMessage sendThroughSmtp(EmailMessage message) throws Exception {
        JavaMailSender mail = mock(JavaMailSender.class);
        when(mail.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        new SmtpEmailSender(providerOf(mail), PROPS).send(message);
        ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mail).send(sent.capture());
        MimeMessage out = sent.getValue();
        out.saveChanges();
        return out;
    }

    // ── ObjectProvider stubs ─────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private static ObjectProvider<JavaMailSender> emptyProvider() {
        ObjectProvider<JavaMailSender> p = mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(null);
        return p;
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<JavaMailSender> providerOf(JavaMailSender sender) {
        ObjectProvider<JavaMailSender> p = mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(sender);
        when(p.getObject()).thenReturn(sender);
        return p;
    }
}
