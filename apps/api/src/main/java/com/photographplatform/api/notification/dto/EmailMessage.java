package com.photographplatform.api.notification.dto;

import java.util.UUID;

/**
 * A transactional email at the point of use: recipient, subject, rendered HTML,
 * and the two things a log is allowed to name.
 *
 * <p>The sender address is deliberately NOT part of this record — it's stamped
 * by the active {@code EmailSender} from {@code app.email.from} / {@code from-name},
 * so callers never need to know or agree on the from-address.
 *
 * @param to        recipient; never logged
 * @param subject   subject line; never logged — it has carried a sign-in code
 * @param htmlBody  rendered body; never logged
 * @param type      what this message is, which is what logs say instead
 * @param tenantId  whose studio this concerns, or {@code null} where the call
 *                  site genuinely does not know — three domain events do not
 *                  carry it yet, see the follow-ups in docs/BUGS.md
 */
public record EmailMessage(
    String to,
    String subject,
    String htmlBody,
    EmailType type,
    UUID tenantId
) {}
