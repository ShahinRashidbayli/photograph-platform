package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.dto.EmailMessage;

/**
 * Transport SPI for outbound transactional email. Exactly one implementation is
 * active at a time, selected by {@code app.email.provider} via
 * {@code @ConditionalOnProperty} (see {@code SendGridEmailSender},
 * {@code ResendEmailSender}, {@code NoOpEmailSender}).
 *
 * <p>Implementations perform the raw send and throw on failure. Callers never
 * see that: they queue through {@link EmailService}, and the outbox worker
 * turns a throw into a retry with backoff (ADR-005).
 */
public interface EmailSender {
    void send(EmailMessage message);

    /**
     * The transport's name, for logs. Not the class name: what matters when
     * reading a delivery failure is which provider was asked, and that is a
     * configuration value the reader can act on.
     */
    String providerName();
}
