package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.dto.EmailMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Logging-only transport. Active when {@code app.email.provider=none} or when
 * the property is absent entirely ({@code matchIfMissing = true}), so local dev
 * and tests run without external calls or credentials.
 */
@Component
@ConditionalOnProperty(name = "app.email.provider", havingValue = "none", matchIfMissing = true)
public class NoOpEmailSender implements EmailSender {

    private static final Logger LOG = LoggerFactory.getLogger(NoOpEmailSender.class);

    @Override
    public void send(EmailMessage message) {
        LOG.info("Email sent provider={} type={} tenant={}",
            providerName(), message.type(), message.tenantId());
    }

    @Override
    public String providerName() {
        return "none";
    }
}
