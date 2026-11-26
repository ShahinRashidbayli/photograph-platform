package com.photographplatform.api.notification.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.photographplatform.api.common.outbox.Outbox;
import com.photographplatform.api.common.outbox.OutboxEntry;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.email.EmailRenderer;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;

/**
 * Façade every caller uses for transactional email.
 *
 * <p>{@link #queue} writes the email to the outbox inside the caller's
 * transaction (ADR-005): nothing is sent for a write that rolls back, and
 * nothing queued is lost to a deploy or a crash. {@link EmailDeliveryHandler}
 * later renders it and hands it to {@link #deliver}, which calls the active
 * {@link EmailSender}; a failure there is retried with backoff by the outbox
 * worker rather than logged and dropped.
 *
 * <p>Callers depend only on this class — never on a concrete provider — so
 * switching SendGrid ⇄ Resend is a config change alone.
 */
@Service
public class EmailService {

    /*
     * Logs name the transport, the kind of message and the tenant — never the
     * recipient, the subject or the body. Those used to be logged on both the
     * success and the failure path, and the sign-in code travels in a subject,
     * so a live credential reached the application log on every send. See
     * BUG-014 in docs/BUGS.md.
     */

    private static final Logger LOG = LoggerFactory.getLogger(EmailService.class);

    /** The outbox queue email is drained from, by {@link EmailOutboxPoller}. */
    public static final String QUEUE = "email";
    /** The outbox job kind {@link EmailDeliveryHandler} runs. */
    public static final String KIND = "email";
    /** Payload keys for the per-message sender, read back by {@link EmailDeliveryHandler}. */
    static final String FROM_NAME = "fromName";
    static final String REPLY_TO = "replyTo";

    private final EmailSender sender;
    private final Outbox outbox;
    private final EmailRenderers renderers;
    private final ObjectMapper objectMapper;

    public EmailService(EmailSender sender, Outbox outbox, EmailRenderers renderers, ObjectMapper objectMapper) {
        this.sender = sender;
        this.outbox = outbox;
        this.renderers = renderers;
        this.objectMapper = objectMapper;
    }

    /**
     * Queues the email in the caller's transaction, or in its own when there
     * is none. A cheap local insert: no provider latency reaches the request,
     * and no pooled connection waits on a mail server.
     *
     * <p>A failure here is a database failure in the caller's transaction,
     * which is doomed either way — so it is not caught, by this method or by
     * its callers.
     *
     * @return false if an email with the same idempotency key is already queued
     */
    public boolean queue(OutgoingEmail email) {
        EmailRenderer<?> renderer = renderers.get(email.template());
        if (!renderer.paramsType().isInstance(email.params())) {
            throw new IllegalArgumentException("Template " + email.template() + " takes "
                + renderer.paramsType().getSimpleName() + ", got " + email.params().getClass().getSimpleName());
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("template", email.template());
        payload.put("params", email.params());
        // Frozen here, not looked up at send time: the worker never resolves a
        // tenant, and the recipient sees the sender as it was when queued.
        if (email.fromName() != null) {
            payload.put(FROM_NAME, email.fromName());
        }
        if (email.replyTo() != null) {
            payload.put(REPLY_TO, email.replyTo());
        }
        return outbox.enqueue(new OutboxEntry(
            QUEUE,
            KIND,
            email.tenantId(),
            toJson(payload),
            email.to(),
            renderer.type().priority(),
            email.expiresAt(),
            email.idempotencyKey()));
    }

    /**
     * Hands a rendered message to the transport, now, on this thread. Throws
     * on failure so the outbox retries it. Only {@link EmailDeliveryHandler}
     * calls this; everything else queues.
     */
    public void deliver(EmailMessage message) {
        try {
            sender.send(message);
        } catch (RestClientResponseException e) {
            // The provider answered and refused. Its status is the one thing
            // that says whether this is ours to fix (401: bad key, 429: over
            // rate) or theirs to wait out (5xx).
            LOG.warn("Email send failed provider={} type={} tenant={} status={}",
                sender.providerName(), message.type(), message.tenantId(), e.getStatusCode().value());
            throw e;
        } catch (RuntimeException e) {
            LOG.warn("Email send failed provider={} type={} tenant={} status=none: {}",
                sender.providerName(), message.type(), message.tenantId(), e.getClass().getSimpleName());
            throw e;
        }
    }

    private String toJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Email params are not serialisable", e);
        }
    }
}
