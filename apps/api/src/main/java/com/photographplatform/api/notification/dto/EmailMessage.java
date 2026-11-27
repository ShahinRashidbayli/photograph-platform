package com.photographplatform.api.notification.dto;

import com.photographplatform.api.common.util.Normalize;
import java.util.UUID;

/**
 * A transactional email at the point of use: recipient, subject, rendered HTML,
 * and the two things a log is allowed to name.
 *
 * <p>The sender address is deliberately NOT part of this record — it's stamped
 * by the active {@code EmailSender} from {@code app.email.from}, so callers
 * never need to know or agree on the from-address. Only the display name may
 * vary per message: a Customer message goes out under the studio's name.
 *
 * @param to        recipient; never logged
 * @param subject   subject line; never logged — it has carried a sign-in code
 * @param htmlBody  rendered body; never logged
 * @param type      what this message is, which is what logs say instead
 * @param tenantId  whose studio this concerns, or {@code null} where the call
 *                  site genuinely does not know — three domain events do not
 *                  carry it yet, see the follow-ups in docs/BUGS.md
 * @param fromName  display name for this message, or {@code null} for the
 *                  global {@code app.email.from-name}
 * @param replyTo   Reply-To address, or {@code null} for none; never logged
 */
public record EmailMessage(
    String to,
    String subject,
    String htmlBody,
    EmailType type,
    UUID tenantId,
    String fromName,
    String replyTo
) {

    public EmailMessage {
        // Blank counts as absent, as for fromName: SMTP throws on "", and the
        // HTTP providers answer 400, so the message would never go out.
        replyTo = Normalize.trimToNull(replyTo);
    }

    /** Sent as Fotolio: the global sender name, and no Reply-To. */
    public EmailMessage(String to, String subject, String htmlBody, EmailType type, UUID tenantId) {
        this(to, subject, htmlBody, type, tenantId, null, null);
    }

    /**
     * The display name to send under: this message's own, else the global one.
     * Blank counts as absent, so a studio without a name never sends nameless.
     *
     * @return the name, or {@code null} when neither is set
     */
    public String senderName(String globalFromName) {
        if (fromName != null && !fromName.isBlank()) {
            return fromName;
        }
        return globalFromName != null && !globalFromName.isBlank() ? globalFromName : null;
    }
}
