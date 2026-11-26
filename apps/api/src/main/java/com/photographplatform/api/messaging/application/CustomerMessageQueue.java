package com.photographplatform.api.messaging.application;

import com.photographplatform.api.messaging.domain.StudioIdentity;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.service.EmailService;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.stereotype.Service;

/**
 * Queues a Customer message through the {@code notification} outbox, in the
 * studio's name.
 *
 * <p>Resolves the {@link StudioIdentity} now and hands it to the caller's
 * params factory, so it is frozen into the outbox row: the worker renders from
 * those params and never looks the tenant up. The sender name and Reply-To
 * come from the same identity.
 *
 * <p>The idempotency key is per send action, {@code TYPE:aggregateId:sentAt},
 * not per aggregate: "Erneut senden" is meant to send again, so a key of
 * {@code TYPE:aggregateId} would swallow every resend while the first waits.
 * One click is one action is one key; the button stays disabled while the
 * request runs. The time is the caller's, the moment the action happened, so
 * the key is the event's and not whenever this listener got to it.
 */
@Service
public class CustomerMessageQueue {

    private final StudioIdentityResolver identities;
    private final EmailService emailService;

    public CustomerMessageQueue(StudioIdentityResolver identities, EmailService emailService) {
        this.identities = identities;
        this.emailService = emailService;
    }

    /**
     * One Customer message to queue.
     *
     * @param template    the {@code EmailRenderer#template()} that renders it
     * @param type        what it is; prefixes the idempotency key
     * @param aggregateId the contract, gallery, lead… it is about
     * @param tenantId    the studio speaking
     * @param to          the Customer's address; never logged
     * @param params      builds the renderer's params around the resolved identity
     * @param expiresAt   dropped instead of sent past this instant; null for never
     * @param sentAt      when the send action happened; the last part of the key
     */
    public record Message(
        String template,
        EmailType type,
        UUID aggregateId,
        UUID tenantId,
        String to,
        Function<StudioIdentity, Object> params,
        OffsetDateTime expiresAt,
        Instant sentAt
    ) {
        public Message {
            Objects.requireNonNull(template, "template");
            Objects.requireNonNull(type, "type");
            Objects.requireNonNull(aggregateId, "aggregateId");
            Objects.requireNonNull(tenantId, "tenantId");
            Objects.requireNonNull(to, "to");
            Objects.requireNonNull(params, "params");
            Objects.requireNonNull(sentAt, "sentAt");
        }
    }

    /** @return false if this exact send was already queued */
    public boolean queue(Message message) {
        StudioIdentity studio = identities.resolve(message.tenantId());
        return emailService.queue(new OutgoingEmail(
            message.template(),
            message.to(),
            message.tenantId(),
            message.params().apply(studio),
            message.type().name() + ":" + message.aggregateId() + ":" + message.sentAt(),
            message.expiresAt(),
            studio.displayName(),
            studio.replyTo()));
    }
}
