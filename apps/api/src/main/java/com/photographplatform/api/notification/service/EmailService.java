package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.dto.EmailMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Façade every caller uses to send transactional email. Delegates the actual
 * transport to the active {@link EmailSender} (chosen by
 * {@code app.email.provider}) and owns the best-effort contract: a delivery
 * failure is logged, never thrown, so a mail outage can't roll back or break
 * the auth / booking flow that triggered it.
 *
 * <p>Callers depend only on this class and {@link EmailMessage} — never on a
 * concrete provider — so switching SendGrid ⇄ Resend is a config change alone.
 */
@Service
public class EmailService {

    private static final Logger LOG = LoggerFactory.getLogger(EmailService.class);

    private final EmailSender sender;

    public EmailService(EmailSender sender) {
        this.sender = sender;
    }

    public void send(EmailMessage message) {
        try {
            sender.send(message);
        } catch (Exception e) {
            LOG.error("Failed to send email to='{}' subject='{}': {}", message.to(),
                message.subject(), e.getMessage(), e);
        }
    }
}
