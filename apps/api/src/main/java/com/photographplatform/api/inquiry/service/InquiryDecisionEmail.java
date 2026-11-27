package com.photographplatform.api.inquiry.service;

import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.RenderedEmail;
import org.springframework.stereotype.Component;

/**
 * The old English request decision. Nothing queues it any more: the Customer
 * message {@code messaging.request-decision} replaced it.
 *
 * <p>Still registered for one release, so rows already in the outbox under
 * {@link #TEMPLATE} still render instead of failing; remove it after that.
 */
@Component
public class InquiryDecisionEmail implements EmailRenderer<InquiryDecisionEmail.Params> {

    /** Stored in queued rows; never rename (see {@link EmailRenderer}). */
    public static final String TEMPLATE = "inquiry.decision";

    public record Params(String customerName, boolean accepted) {}

    @Override
    public String template() {
        return TEMPLATE;
    }

    @Override
    public EmailType type() {
        return EmailType.INQUIRY_REPLY;
    }

    @Override
    public Class<Params> paramsType() {
        return Params.class;
    }

    @Override
    public RenderedEmail render(Params params) {
        boolean accepted = params.accepted();
        String subject = accepted
            ? "Your booking request was accepted"
            : "Update on your booking request";
        String message = accepted
            ? "Great news — your photographer accepted your request and started a booking. "
                + "They'll be in touch shortly to confirm the details."
            : "Thank you for reaching out. Unfortunately your photographer isn't able to take "
                + "this booking. We wish you the very best finding the right fit.";
        String html = EmailTemplate.document(
            accepted
                ? "Good news — your photographer accepted your request."
                : "An update on your booking request.",
            EmailTemplate.heading(subject)
                + EmailTemplate.paragraph("Hi " + HtmlEscape.escape(params.customerName()) + ",")
                + EmailTemplate.paragraph(message));
        return new RenderedEmail(subject, html);
    }
}
