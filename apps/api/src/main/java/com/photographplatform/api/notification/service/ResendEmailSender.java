package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.config.EmailHttpClientConfig;
import com.photographplatform.api.notification.config.EmailProperties;
import com.photographplatform.api.notification.dto.EmailMessage;
import jakarta.mail.internet.InternetAddress;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Resend transport. Active when {@code app.email.provider=resend}. Kept as a
 * fallback provider — swapping back is a single env-var change.
 */
@Component
@ConditionalOnProperty(name = "app.email.provider", havingValue = "resend")
public class ResendEmailSender implements EmailSender {

    private static final Logger LOG = LoggerFactory.getLogger(ResendEmailSender.class);

    private final RestClient restClient;
    private final EmailProperties props;

    /**
     * Takes the non-retrying client rather than building one from the shared
     * builder: a provider's 429 names a delay in {@code Retry-After}, and the
     * default client waits it out on the sending thread. See
     * {@link EmailHttpClientConfig}.
     */
    public ResendEmailSender(
        @Qualifier(EmailHttpClientConfig.EMAIL_REST_CLIENT) RestClient restClient,
        EmailProperties props) {
        this.restClient = restClient;
        this.props = props;
    }

    @Override
    public void send(EmailMessage message) {
        // Guaranteed configured — see the startup validation in EmailProperties.
        EmailProperties.Provider resend = props.resend();

        String fromHeader = fromHeader(message);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("from", fromHeader);
        payload.put("to", message.to());
        if (message.replyTo() != null) {
            payload.put("reply_to", message.replyTo());
        }
        payload.put("subject", message.subject());
        payload.put("html", message.htmlBody());

        restClient.post()
            .uri(resend.baseUrl() + "/emails")
            .header("Authorization", "Bearer " + resend.apiKey())
            .body(payload)
            .retrieve()
            .toBodilessEntity();

        LOG.info("Email sent provider={} type={} tenant={}",
            providerName(), message.type(), message.tenantId());
    }

    /**
     * Resend accepts a display name via the RFC 5322 "Name <email>" form. A
     * studio's name may carry a comma or quotes ("Müller, Fotografie"), which
     * unquoted would read as two addresses, so the phrase is quoted by
     * InternetAddress rather than by string concatenation.
     */
    private String fromHeader(EmailMessage message) {
        String name = message.senderName(props.fromName());
        if (name == null) {
            return props.from();
        }
        try {
            return new InternetAddress(props.from(), name, StandardCharsets.UTF_8.name()).toUnicodeString();
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException("UTF-8 is always supported", e);
        }
    }

    @Override
    public String providerName() {
        return "resend";
    }
}
