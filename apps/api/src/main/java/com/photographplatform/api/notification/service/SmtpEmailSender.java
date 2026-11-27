package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.config.EmailProperties;
import com.photographplatform.api.notification.dto.EmailMessage;
import jakarta.annotation.PostConstruct;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

/**
 * SMTP transport. Active when {@code app.email.provider=smtp}.
 *
 * <p>Exists mainly so email can be exercised locally. The other transports are
 * hosted APIs needing an account and a verified sender, so on a dev machine
 * the only workable setting was {@code none} — which logs and drops. That made
 * every email-gated flow untestable: customer magic-link sign-in (the only way
 * a client signs in at all), address verification, password reset, lead
 * auto-replies. {@code docker-compose} has run a Mailpit container the whole
 * time with nothing able to talk to it.
 *
 * <p>It is a legitimate production transport too — a company relaying through
 * its own mail server needs no API key — but the hosted providers remain the
 * default for deliverability.
 *
 * <p>Connection settings come from Spring's own {@code spring.mail.*}, so
 * every JavaMail knob (STARTTLS, auth, timeouts) is configurable without
 * touching this class.
 */
@Component
@ConditionalOnProperty(name = "app.email.provider", havingValue = "smtp")
public class SmtpEmailSender implements EmailSender {

    private static final Logger LOG = LoggerFactory.getLogger(SmtpEmailSender.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    private final EmailProperties props;

    public SmtpEmailSender(ObjectProvider<JavaMailSender> mailSender, EmailProperties props) {
        this.mailSender = mailSender;
        this.props = props;
    }

    /**
     * Spring Boot only builds a {@code JavaMailSender} when {@code
     * spring.mail.host} is set. Injecting it directly would therefore fail
     * with a NoSuchBeanDefinitionException naming a bean the operator never
     * asked for — accurate, and useless. Say what is actually missing, and say
     * it at boot rather than at the first magic link nobody receives.
     */
    @PostConstruct
    void requireMailHost() {
        if (mailSender.getIfAvailable() == null) {
            throw new IllegalStateException(
                "EMAIL_PROVIDER=smtp but SPRING_MAIL_HOST is not set. Point it at a mail "
                    + "server (locally: SPRING_MAIL_HOST=localhost, SPRING_MAIL_PORT=1025 for "
                    + "the Mailpit container from infra/docker-compose.yml), or set "
                    + "EMAIL_PROVIDER=none to run without email.");
        }
    }

    @Override
    public void send(EmailMessage message) {
        JavaMailSender sender = mailSender.getObject();
        MimeMessage mime = sender.createMimeMessage();
        try {
            // true = multipart, so the HTML part is declared properly rather
            // than arriving as a wall of markup in a text/plain body.
            MimeMessageHelper helper =
                new MimeMessageHelper(mime, true, StandardCharsets.UTF_8.name());
            helper.setFrom(fromAddress(message));
            if (message.replyTo() != null) {
                helper.setReplyTo(message.replyTo());
            }
            helper.setTo(message.to());
            helper.setSubject(message.subject());
            helper.setText(message.htmlBody(), true);
        } catch (jakarta.mail.MessagingException | UnsupportedEncodingException e) {
            // Wrapped in Spring's own mail exception so the outbox retries
            // this like any other transport failure.
            throw new MailPreparationException("Could not build the SMTP message", e);
        }

        sender.send(mime);
        LOG.info("Email sent provider={} type={} tenant={}",
            providerName(), message.type(), message.tenantId());
    }

    private InternetAddress fromAddress(EmailMessage message)
        throws UnsupportedEncodingException, jakarta.mail.internet.AddressException {
        String name = message.senderName(props.fromName());
        return name != null
            ? new InternetAddress(props.from(), name, StandardCharsets.UTF_8.name())
            : new InternetAddress(props.from());
    }

    @Override
    public String providerName() {
        return "smtp";
    }
}
