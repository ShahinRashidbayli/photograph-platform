package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.config.EmailHttpClientConfig;
import com.photographplatform.api.notification.config.EmailProperties;
import com.photographplatform.api.notification.dto.EmailMessage;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * SendGrid v3 Mail Send transport. Active when {@code app.email.provider=sendgrid}.
 * On success the API returns 202 Accepted with an empty body.
 */
@Component
@ConditionalOnProperty(name = "app.email.provider", havingValue = "sendgrid")
public class SendGridEmailSender implements EmailSender {

    private static final Logger LOG = LoggerFactory.getLogger(SendGridEmailSender.class);

    private final RestClient restClient;
    private final EmailProperties props;

    /**
     * Takes the non-retrying client rather than building one from the shared
     * builder: a provider's 429 names a delay in {@code Retry-After}, and the
     * default client waits it out on the sending thread. See
     * {@link EmailHttpClientConfig}.
     */
    public SendGridEmailSender(
        @Qualifier(EmailHttpClientConfig.EMAIL_REST_CLIENT) RestClient restClient,
        EmailProperties props) {
        this.restClient = restClient;
        this.props = props;
    }

    @Override
    public void send(EmailMessage message) {
        // Credentials are guaranteed present: EmailProperties refuses to start the
        // application when sendgrid is selected without an API key. Silently
        // skipping here instead would be the exact failure mode that validation
        // exists to prevent — mail vanishing while every endpoint reports success.
        EmailProperties.Provider sg = props.sendgrid();

        Map<String, Object> from = props.fromName() != null && !props.fromName().isBlank()
            ? Map.of("email", props.from(), "name", props.fromName())
            : Map.of("email", props.from());

        Map<String, Object> payload = Map.of(
            "personalizations", List.of(Map.of(
                "to", List.of(Map.of("email", message.to()))
            )),
            "from", from,
            "subject", message.subject(),
            "content", List.of(Map.of(
                "type", "text/html",
                "value", message.htmlBody()
            ))
        );

        restClient.post()
            .uri(sg.baseUrl() + "/v3/mail/send")
            .header("Authorization", "Bearer " + sg.apiKey())
            .body(payload)
            .retrieve()
            .toBodilessEntity();

        LOG.info("Email sent provider={} type={} tenant={}",
            providerName(), message.type(), message.tenantId());
    }

    @Override
    public String providerName() {
        return "sendgrid";
    }
}
