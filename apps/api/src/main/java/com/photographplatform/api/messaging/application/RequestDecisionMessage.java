package com.photographplatform.api.messaging.application;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.inquiry.event.InquiryDecidedEvent;
import com.photographplatform.api.messaging.domain.CustomerMessageLayout;
import com.photographplatform.api.messaging.domain.PersonalNote;
import com.photographplatform.api.messaging.domain.StudioIdentity;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.RenderedEmail;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.util.UriUtils;

/**
 * Request decision: the studio tells a Customer, in its own name and in the
 * Customer's language, that it accepted or declined their request.
 *
 * <ul>
 *   <li><em>Accepted</em> links to the booking through the portal deep link:
 *       the Customer sign-in, which sends them on to their booking once they
 *       have entered their code.</li>
 *   <li><em>Declined</em> is short and polite, with no link: there is nothing
 *       in the portal for them to do.</li>
 * </ul>
 *
 * <p>Either can carry the photographer's {@link PersonalNote}, always escaped.
 * Queued before commit in the decision's transaction (ADR-005): if accepting
 * fails and rolls back, no "accepted" message goes out.
 */
@Service
public class RequestDecisionMessage implements EmailRenderer<RequestDecisionMessage.Params> {

    /** Stored in queued rows; must not change. */
    public static final String TEMPLATE = "messaging.request-decision";

    /**
     * @param studio       who speaks, frozen at queue time
     * @param language     the Customer's
     * @param customerName how the studio knows them; may be blank
     * @param accepted     the decision
     * @param bookingUrl   the portal deep link to the booking; null when declined
     * @param note         the photographer's personal note, unescaped; null for none
     */
    public record Params(StudioIdentity studio, CustomerLanguage language, String customerName,
                         boolean accepted, String bookingUrl, String note) {}

    private final CustomerMessageQueue queue;
    private final PublicTenantResolver tenants;
    private final String webBaseUrl;

    public RequestDecisionMessage(CustomerMessageQueue queue, PublicTenantResolver tenants,
                                  @Value("${app.web.base-url:http://localhost:3000}") String webBaseUrl) {
        this.queue = queue;
        this.tenants = tenants;
        this.webBaseUrl = webBaseUrl;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onInquiryDecided(InquiryDecidedEvent event) {
        String bookingUrl = event.isAccepted() && event.getBookingId() != null
            ? bookingUrl(event.getTenantId(), event.getRecipientEmail(), event.getBookingId())
            : null;
        queue.queue(new CustomerMessageQueue.Message(
            TEMPLATE,
            EmailType.CUSTOMER_REQUEST_DECISION,
            event.getInquiryId(),
            event.getTenantId(),
            event.getRecipientEmail(),
            studio -> new Params(studio, event.getLanguage(), event.getRecipientName(), event.isAccepted(),
                bookingUrl, event.getNote()),
            null));
    }

    /*
     * The Customer sign-in, not the booking itself: the Customer is signed out
     * when they open an email days later. The sign-in already knows the studio
     * and the address, so only the code is left to enter, and `next` brings
     * them to the booking detail, which is the bookings page with ?id=.
     */
    private String bookingUrl(UUID tenantId, String email, UUID bookingId) {
        String subdomain = tenants.requireById(tenantId).getSubdomain();
        return webBaseUrl + "/customer/auth/login"
            + "?subdomain=" + UriUtils.encode(subdomain, StandardCharsets.UTF_8)
            + "&email=" + UriUtils.encode(email, StandardCharsets.UTF_8)
            + "&next=" + UriUtils.encode("/bookings?id=" + bookingId, StandardCharsets.UTF_8);
    }

    @Override
    public String template() {
        return TEMPLATE;
    }

    @Override
    public EmailType type() {
        return EmailType.CUSTOMER_REQUEST_DECISION;
    }

    @Override
    public Class<Params> paramsType() {
        return Params.class;
    }

    @Override
    public RenderedEmail render(Params params) {
        Copy copy = params.language() == CustomerLanguage.EN ? Copy.EN : Copy.DE;
        StudioIdentity studio = params.studio();
        String name = studio.displayName();
        String escapedName = name == null ? null : "<strong>" + HtmlEscape.escape(name) + "</strong>";
        String customer = params.customerName() == null ? "" : params.customerName().strip();
        String greeting = customer.isEmpty()
            ? copy.greeting + ","
            : copy.greeting + " " + HtmlEscape.escape(customer) + ",";
        String signOff = name == null ? copy.signOff : copy.signOff + "<br>" + escapedName;
        PersonalNote note = PersonalNote.ofNullable(params.note());

        StringBuilder body = new StringBuilder();
        String subject;
        String heading;
        if (params.accepted()) {
            subject = name == null ? copy.acceptedSubject : copy.acceptedSubjectWith.formatted(name);
            heading = copy.acceptedHeading;
            body.append(CustomerMessageLayout.heading(heading))
                .append(CustomerMessageLayout.paragraph(greeting))
                .append(CustomerMessageLayout.paragraph(name == null
                    ? copy.accepted
                    : copy.acceptedWith.formatted(escapedName)))
                .append(CustomerMessageLayout.personalNote(studio, note));
            if (params.bookingUrl() != null) {
                body.append(CustomerMessageLayout.paragraph(copy.portal))
                    .append(CustomerMessageLayout.button(studio, copy.bookingButton, params.bookingUrl()));
            }
            body.append(CustomerMessageLayout.paragraph(copy.reply));
        } else {
            subject = name == null ? copy.declinedSubject : copy.declinedSubjectWith.formatted(name);
            heading = copy.declinedHeading;
            body.append(CustomerMessageLayout.heading(heading))
                .append(CustomerMessageLayout.paragraph(greeting))
                .append(CustomerMessageLayout.paragraph(name == null
                    ? copy.declined
                    : copy.declinedWith.formatted(escapedName)))
                .append(CustomerMessageLayout.personalNote(studio, note))
                .append(CustomerMessageLayout.paragraph(copy.wishes));
        }
        body.append(CustomerMessageLayout.paragraph(signOff));

        return new RenderedEmail(subject,
            CustomerMessageLayout.document(studio, params.language(), heading, body.toString()));
    }

    /**
     * The fixed copy, addressed with <em>Sie</em>. The {@code …With} variants
     * take the studio's name; the others stand in while a studio has none.
     */
    private enum Copy {
        DE("Ihre Anfrage wurde angenommen", "Ihre Anfrage bei %s wurde angenommen",
            "Ihre Anfrage wurde angenommen",
            "gute Nachrichten: Ihre Anfrage wurde angenommen und eine Buchung für Sie angelegt.",
            "gute Nachrichten: %s hat Ihre Anfrage angenommen und eine Buchung für Sie angelegt.",
            "Die Details Ihrer Buchung finden Sie im Kundenportal. Nach der Anmeldung mit Ihrem Code "
                + "gelangen Sie direkt zu Ihrer Buchung.",
            "Buchung ansehen",
            "Bei Fragen antworten Sie einfach auf diese E-Mail.",
            "Ihre Anfrage", "Ihre Anfrage bei %s",
            "Vielen Dank für Ihre Anfrage",
            "vielen Dank für Ihr Interesse. Leider kann Ihre Anfrage dieses Mal nicht angenommen werden.",
            "vielen Dank für Ihr Interesse. Leider kann %s Ihre Anfrage dieses Mal nicht annehmen.",
            "Wir wünschen Ihnen alles Gute.",
            "Guten Tag", "Freundliche Grüße"),
        EN("Your request was accepted", "Your request to %s was accepted",
            "Your request was accepted",
            "Good news: your request was accepted and a booking has been created for you.",
            "Good news: %s has accepted your request and created a booking for you.",
            "You will find the details of your booking in the customer portal. After signing in with "
                + "your code you will go straight to your booking.",
            "View booking",
            "If you have any questions, simply reply to this email.",
            "Your request", "Your request to %s",
            "Thank you for your request",
            "Thank you for your interest. Unfortunately your request cannot be accepted this time.",
            "Thank you for your interest. Unfortunately %s is unable to accept your request this time.",
            "We wish you all the best.",
            "Hello", "Kind regards");

        private final String acceptedSubject;
        private final String acceptedSubjectWith;
        private final String acceptedHeading;
        private final String accepted;
        private final String acceptedWith;
        private final String portal;
        private final String bookingButton;
        private final String reply;
        private final String declinedSubject;
        private final String declinedSubjectWith;
        private final String declinedHeading;
        private final String declined;
        private final String declinedWith;
        private final String wishes;
        private final String greeting;
        private final String signOff;

        @SuppressWarnings("checkstyle:ParameterNumber")
        Copy(String acceptedSubject, String acceptedSubjectWith, String acceptedHeading, String accepted,
             String acceptedWith, String portal, String bookingButton, String reply, String declinedSubject,
             String declinedSubjectWith, String declinedHeading, String declined, String declinedWith,
             String wishes, String greeting, String signOff) {
            this.acceptedSubject = acceptedSubject;
            this.acceptedSubjectWith = acceptedSubjectWith;
            this.acceptedHeading = acceptedHeading;
            this.accepted = accepted;
            this.acceptedWith = acceptedWith;
            this.portal = portal;
            this.bookingButton = bookingButton;
            this.reply = reply;
            this.declinedSubject = declinedSubject;
            this.declinedSubjectWith = declinedSubjectWith;
            this.declinedHeading = declinedHeading;
            this.declined = declined;
            this.declinedWith = declinedWith;
            this.wishes = wishes;
            this.greeting = greeting;
            this.signOff = signOff;
        }
    }
}
