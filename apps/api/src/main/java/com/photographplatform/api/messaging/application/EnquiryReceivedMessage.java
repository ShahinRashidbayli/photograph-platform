package com.photographplatform.api.messaging.application;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.messaging.domain.CustomerMessageLayout;
import com.photographplatform.api.messaging.domain.StudioIdentity;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.RenderedEmail;
import com.photographplatform.api.portfolio.service.PortfolioPublication;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.util.UriUtils;

/**
 * Enquiry received: the studio tells a Customer, in its own name and in the
 * Customer's language, that their enquiry arrived.
 *
 * <p>It promises nothing. The message it replaces listed packages, prices and
 * "über 100 Hochzeiten Erfahrung" that no studio had entered (#103); what the
 * studio offers, and whether and when it answers, is for the studio to say in
 * its own reply. The Reply-To is the studio's, so "Reply" reaches it.
 *
 * <p>Queued before commit in the lead's transaction (ADR-005), and only:
 * <ul>
 *   <li>for a lead from the public request form: one the studio typed in is a
 *       conversation the Customer already had;</li>
 *   <li>while the studio leaves {@code enquiryAcknowledgementEnabled} on: a
 *       photographer who answers every enquiry personally switches it off.</li>
 * </ul>
 */
@Service
public class EnquiryReceivedMessage implements EmailRenderer<EnquiryReceivedMessage.Params> {

    /** Stored in queued rows; must not change. */
    public static final String TEMPLATE = "messaging.enquiry-received";

    /**
     * @param studio       who speaks, frozen at queue time
     * @param language     the Customer's
     * @param customerName as typed on the form; may be blank
     * @param portfolioUrl the studio's public portfolio, or null when it shows
     *                     nothing yet
     */
    public record Params(StudioIdentity studio, CustomerLanguage language, String customerName,
                         String portfolioUrl) {}

    private final CustomerMessageQueue queue;
    private final PublicTenantResolver tenants;
    private final PortfolioPublication portfolio;
    private final String webBaseUrl;

    public EnquiryReceivedMessage(CustomerMessageQueue queue, PublicTenantResolver tenants,
                                  PortfolioPublication portfolio,
                                  @Value("${app.web.base-url:http://localhost:3000}") String webBaseUrl) {
        this.queue = queue;
        this.tenants = tenants;
        this.portfolio = portfolio;
        this.webBaseUrl = webBaseUrl;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onLeadCreated(LeadCreatedEvent event) {
        // Allow-list: writing to a Customer is opt-in, so an origin added later
        // sends nothing until someone decides it should.
        if (event.getOrigin() != LeadCreatedEvent.Origin.PUBLIC_FORM) {
            return;
        }
        Tenant tenant = tenants.requireById(event.getTenantId());
        if (!tenant.isEnquiryAcknowledgementEnabled()) {
            return;
        }
        // Read here, in the lead's transaction, where RLS scopes it to this studio.
        String portfolioUrl = portfolio.isPublished() ? portfolioUrl(tenant) : null;
        queue.queue(new CustomerMessageQueue.Message(
            TEMPLATE,
            EmailType.CUSTOMER_ENQUIRY_RECEIVED,
            event.getLeadId(),
            event.getTenantId(),
            event.getClientEmail(),
            studio -> new Params(studio, event.getLanguage(), event.getClientName(), portfolioUrl),
            null));
    }

    private String portfolioUrl(Tenant tenant) {
        return webBaseUrl + "/p/" + UriUtils.encodePathSegment(tenant.getSubdomain(), StandardCharsets.UTF_8);
    }

    @Override
    public String template() {
        return TEMPLATE;
    }

    @Override
    public EmailType type() {
        return EmailType.CUSTOMER_ENQUIRY_RECEIVED;
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
        String customer = params.customerName() == null ? "" : params.customerName().strip();

        String subject = name == null ? copy.subjectWithoutName : copy.subject + name;
        String greeting = customer.isEmpty()
            ? copy.greeting + ","
            : copy.greeting + " " + HtmlEscape.escape(customer) + ",";
        String received = name == null
            ? copy.receivedWithoutName
            : copy.received + "<strong>" + HtmlEscape.escape(name) + "</strong>" + copy.receivedEnd;
        String signOff = name == null
            ? copy.signOff
            : copy.signOff + "<br><strong>" + HtmlEscape.escape(name) + "</strong>";

        StringBuilder body = new StringBuilder()
            .append(CustomerMessageLayout.heading(copy.heading))
            .append(CustomerMessageLayout.paragraph(greeting))
            .append(CustomerMessageLayout.paragraph(received))
            .append(CustomerMessageLayout.paragraph(copy.reply));
        if (params.portfolioUrl() != null) {
            body.append(CustomerMessageLayout.paragraph(copy.portfolio))
                .append(CustomerMessageLayout.button(studio, copy.portfolioButton, params.portfolioUrl()));
        }
        body.append(CustomerMessageLayout.paragraph(signOff))
            .append(CustomerMessageLayout.paragraph(copy.automatic));

        return new RenderedEmail(subject,
            CustomerMessageLayout.document(studio, params.language(), copy.heading, body.toString()));
    }

    /**
     * The fixed copy, addressed with <em>Sie</em>. No packages, prices,
     * experience or response times: only what is true of every enquiry.
     */
    private enum Copy {
        DE("Ihre Anfrage bei ", "Ihre Anfrage ist eingegangen", "Vielen Dank für Ihre Anfrage",
            "Guten Tag",
            "vielen Dank für Ihre Anfrage. Sie ist bei ", " eingegangen.",
            "vielen Dank für Ihre Anfrage. Sie ist eingegangen.",
            "Wenn Sie noch etwas ergänzen möchten, antworten Sie einfach auf diese E-Mail.",
            "Einen Eindruck von unserer Arbeit finden Sie in unserem Portfolio.",
            "Portfolio ansehen",
            "Freundliche Grüße",
            "Diese Bestätigung wurde automatisch versendet."),
        EN("Your enquiry to ", "Your enquiry has arrived", "Thank you for your enquiry",
            "Hello",
            "Thank you for your enquiry. It has reached ", ".",
            "Thank you for your enquiry. It has arrived.",
            "If you would like to add anything, simply reply to this email.",
            "You can get an impression of our work in our portfolio.",
            "View portfolio",
            "Kind regards",
            "This confirmation was sent automatically.");

        private final String subject;
        private final String subjectWithoutName;
        private final String heading;
        private final String greeting;
        private final String received;
        private final String receivedEnd;
        private final String receivedWithoutName;
        private final String reply;
        private final String portfolio;
        private final String portfolioButton;
        private final String signOff;
        private final String automatic;

        Copy(String subject, String subjectWithoutName, String heading, String greeting, String received,
             String receivedEnd, String receivedWithoutName, String reply, String portfolio,
             String portfolioButton, String signOff, String automatic) {
            this.subject = subject;
            this.subjectWithoutName = subjectWithoutName;
            this.heading = heading;
            this.greeting = greeting;
            this.received = received;
            this.receivedEnd = receivedEnd;
            this.receivedWithoutName = receivedWithoutName;
            this.reply = reply;
            this.portfolio = portfolio;
            this.portfolioButton = portfolioButton;
            this.signOff = signOff;
            this.automatic = automatic;
        }
    }
}
