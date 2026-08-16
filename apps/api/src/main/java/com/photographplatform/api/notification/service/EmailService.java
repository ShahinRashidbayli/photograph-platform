package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.dto.EmailMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
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

    /**
     * Hands the message to the transport off the caller's thread.
     *
     * <p>{@code @Async} is what makes the "best-effort" contract above
     * actually cheap. The transport is a blocking HTTPS call to SendGrid /
     * Resend — typically 100-500ms, unbounded if the provider is degraded —
     * and every caller that reaches here directly does so from inside an open
     * {@code @Transactional} method: {@code AuthService#register},
     * {@code PasswordResetService#requestReset},
     * {@code CustomerAuthService#requestMagicLink} and
     * {@code InquiryRequestService#updateStatus}. Sending inline therefore
     * added the provider's full latency to those responses <em>and</em> held a
     * pooled database connection open for the whole round-trip, so a slow mail
     * provider drained the connection pool and stalled requests that had
     * nothing to do with email.
     *
     * <p>(The event listeners in this package — {@code AutoReplyService} and
     * friends — were already {@code @Async} and merely re-queue here; the
     * hand-off is cheap and keeps a single place responsible for the rule.)
     *
     * <p>Unchanged: failures are logged, never thrown. Note this means a send
     * can still be queued for a transaction that later rolls back — true
     * before this change too, since the inline send also happened pre-commit.
     * Making delivery strictly post-commit needs
     * {@code @TransactionalEventListener(AFTER_COMMIT)} at the call sites.
     */
    @Async
    public void send(EmailMessage message) {
        try {
            sender.send(message);
        } catch (Exception e) {
            LOG.error("Failed to send email to='{}' subject='{}': {}", message.to(),
                message.subject(), e.getMessage(), e);
        }
    }
}
