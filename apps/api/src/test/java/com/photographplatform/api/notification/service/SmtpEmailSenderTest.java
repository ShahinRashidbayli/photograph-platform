package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.config.EmailProperties;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
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
