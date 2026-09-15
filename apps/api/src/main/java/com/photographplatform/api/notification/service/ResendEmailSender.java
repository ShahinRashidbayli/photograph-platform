package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.config.EmailHttpClientConfig;
import com.photographplatform.api.notification.config.EmailProperties;
import com.photographplatform.api.notification.dto.EmailMessage;
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

        // Resend accepts a display name via the RFC 5322 "Name <email>" form.
        String fromHeader = props.fromName() != null && !props.fromName().isBlank()
            ? props.fromName() + " <" + props.from() + ">"
            : props.from();

        Map<String, Object> payload = Map.of(
            "from", fromHeader,
            "to", message.to(),
            "subject", message.subject(),
            "html", message.htmlBody()
        );

        restClient.post()
            .uri(resend.baseUrl() + "/emails")
            .header("Authorization", "Bearer " + resend.apiKey())
            .body(payload)
            .retrieve()
            .toBodilessEntity();

        LOG.info("Email sent via Resend to='{}' subject='{}'", message.to(), message.subject());
    }
}
