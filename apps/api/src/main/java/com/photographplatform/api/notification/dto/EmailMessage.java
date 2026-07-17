package com.photographplatform.api.notification.dto;

/**
 * A transactional email at the point of use: recipient, subject, rendered HTML.
 *
 * <p>The sender address is deliberately NOT part of this record — it's stamped
 * by the active {@code EmailSender} from {@code app.email.from} / {@code from-name},
 * so callers never need to know or agree on the from-address.
 */
public record EmailMessage(
    String to,
    String subject,
    String htmlBody
) {}
