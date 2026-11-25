package com.photographplatform.api.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.photographplatform.api.common.outbox.OutboxHandler;
import com.photographplatform.api.common.outbox.OutboxJob;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.RenderedEmail;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;

/**
 * Sends a queued email: renders it from its stored inputs, then delivers.
 *
 * <p>Rendering happens here, at send time, not when the email was queued, so
 * the outbox never holds a body (ADR-005 §3).
 */
@Component
public class EmailDeliveryHandler implements OutboxHandler {

    private final EmailService emailService;
    private final EmailRenderers renderers;
    private final ObjectMapper objectMapper;

    public EmailDeliveryHandler(EmailService emailService, EmailRenderers renderers, ObjectMapper objectMapper) {
        this.emailService = emailService;
        this.renderers = renderers;
        this.objectMapper = objectMapper;
    }

    @Override
    public String kind() {
        return EmailService.KIND;
    }

    @Override
    public void handle(OutboxJob job) throws Exception {
        JsonNode payload = objectMapper.readTree(job.payloadJson());
        EmailRenderer<?> renderer = renderers.get(payload.path("template").asText());
        RenderedEmail rendered = render(renderer, payload.path("params"));
        emailService.deliver(new EmailMessage(
            job.recipientEmail(), rendered.subject(), rendered.htmlBody(), renderer.type(), job.tenantId()));
    }

    private <P> RenderedEmail render(EmailRenderer<P> renderer, JsonNode params) throws Exception {
        return renderer.render(objectMapper.treeToValue(params, renderer.paramsType()));
    }

    /** The provider's status is what says whether to wait (429, 5xx) or fix something (401). */
    @Override
    public String describeFailure(Exception failure) {
        if (failure instanceof RestClientResponseException response) {
            return failure.getClass().getSimpleName() + " status=" + response.getStatusCode().value();
        }
        return failure.getClass().getSimpleName();
    }
}
