package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.dto.EmailMessage;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class EmailService {

    private static final Logger LOG = LoggerFactory.getLogger(EmailService.class);

    @Value("${resend.api-key:}")
    private String apiKey;

    @Value("${resend.base-url:https://api.resend.com}")
    private String baseUrl;

    private final RestClient restClient;

    public EmailService(RestClient.Builder builder) {
        this.restClient = builder.build();
    }

    @SuppressWarnings("unchecked")
    public void send(EmailMessage message) {
        if (apiKey == null || apiKey.isBlank()) {
            LOG.info("EMAIL (no-op mode) to='{}' subject='{}'", message.to(), message.subject());
            return;
        }

        try {
            Map<String, Object> payload = Map.of(
                "from", message.from(),
                "to", message.to(),
                "subject", message.subject(),
                "html", message.htmlBody()
            );

            restClient.post()
                .uri(baseUrl + "/emails")
                .header("Authorization", "Bearer " + apiKey)
                .body(payload)
                .retrieve()
                .toBodilessEntity();

            LOG.info("Email sent successfully to='{}' subject='{}'", message.to(),
                message.subject());
        } catch (Exception e) {
            LOG.error("Failed to send email to='{}' subject='{}': {}", message.to(),
                message.subject(), e.getMessage(), e);
        }
    }
}
