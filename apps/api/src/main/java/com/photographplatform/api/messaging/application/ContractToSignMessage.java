package com.photographplatform.api.messaging.application;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.contract.event.ContractSentEvent;
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
 * Contract to sign: the studio tells a Customer, in its own name and in the
 * Customer's language, that a contract waits for their signature, with a link
 * that lands them on it after sign-in.
 *
 * <p>Sent on "An Kunden senden" and again on every "Erneut senden": each
 * {@link ContractSentEvent} carries its own {@code sentAt}, so each click is
 * one outbox row ({@code CONTRACT_TO_SIGN:contractId:sentAt}).
 *
 * <p>Can carry the photographer's {@link PersonalNote}, always escaped. Queued
 * before commit in the send's transaction (ADR-005): a send that rolls back
 * tells nobody.
 */
@Service
public class ContractToSignMessage implements EmailRenderer<ContractToSignMessage.Params> {

    /** Stored in queued rows; must not change. */
    public static final String TEMPLATE = "messaging.contract-to-sign";

    /**
     * @param studio       who speaks, frozen at queue time
     * @param language     the Customer's
     * @param customerName how the studio knows them; may be blank
     * @param contractUrl  the portal deep link to the contract
     * @param personalNote the photographer's personal note, unescaped; null for none
     */
    public record Params(StudioIdentity studio, CustomerLanguage language, String customerName,
                         String contractUrl, String personalNote) {}

    private final CustomerMessageQueue queue;
    private final PublicTenantResolver tenants;
    private final String webBaseUrl;

    public ContractToSignMessage(CustomerMessageQueue queue, PublicTenantResolver tenants,
                                 @Value("${app.web.base-url:http://localhost:3000}") String webBaseUrl) {
        this.queue = queue;
        this.tenants = tenants;
        this.webBaseUrl = webBaseUrl;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onContractSent(ContractSentEvent event) {
        String contractUrl = contractUrl(event.getTenantId(), event.getRecipientEmail(), event.getContractId());
        queue.queue(new CustomerMessageQueue.Message(
            TEMPLATE,
            EmailType.CONTRACT_TO_SIGN,
            event.getContractId(),
            event.getTenantId(),
            event.getRecipientEmail(),
            studio -> new Params(studio, event.getLanguage(), event.getRecipientName(), contractUrl,
                event.getPersonalNote()),
            null,
            event.getSentAt()));
    }

    /*
     * The Customer sign-in, not the contract itself: the Customer is signed out
     * when they open the email. The sign-in already knows the studio and the
     * address, so only the code is left to enter, and `next` brings them to the
     * contract, which the portal shows on the documents page with ?id=.
     */
    private String contractUrl(UUID tenantId, String email, UUID contractId) {
        String subdomain = tenants.requireById(tenantId).getSubdomain();
        return webBaseUrl + "/customer/auth/login"
            + "?subdomain=" + UriUtils.encode(subdomain, StandardCharsets.UTF_8)
            + "&email=" + UriUtils.encode(email, StandardCharsets.UTF_8)
            + "&next=" + UriUtils.encode("/documents?id=" + contractId, StandardCharsets.UTF_8);
    }

    @Override
    public String template() {
        return TEMPLATE;
    }

    @Override
    public EmailType type() {
        return EmailType.CONTRACT_TO_SIGN;
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

        String subject = name == null ? copy.subject : copy.subjectWith.formatted(name);
        String body = CustomerMessageLayout.heading(copy.heading)
            + CustomerMessageLayout.paragraph(greeting)
            + CustomerMessageLayout.paragraph(name == null ? copy.intro : copy.introWith.formatted(escapedName))
            + CustomerMessageLayout.personalNote(studio, PersonalNote.ofNullable(params.personalNote()))
            + CustomerMessageLayout.paragraph(copy.portal)
            + CustomerMessageLayout.button(studio, copy.button, params.contractUrl())
            + CustomerMessageLayout.paragraph(copy.reply)
            + CustomerMessageLayout.paragraph(signOff);

        return new RenderedEmail(subject,
            CustomerMessageLayout.document(studio, params.language(), copy.heading, body));
    }

    /**
     * The fixed copy, addressed with <em>Sie</em>. The {@code …With} variants
     * take the studio's name; the others stand in while a studio has none.
     */
    private enum Copy {
        DE("Ihr Vertrag zur Unterschrift", "Ihr Vertrag von %s zur Unterschrift",
            "Ihr Vertrag liegt zur Unterschrift bereit",
            "Ihr Vertrag liegt für Sie bereit. Bitte lesen Sie ihn in Ruhe und unterschreiben Sie ihn "
                + "anschließend online.",
            "%s hat Ihnen einen Vertrag gesendet. Bitte lesen Sie ihn in Ruhe und unterschreiben Sie ihn "
                + "anschließend online.",
            "Nach der Anmeldung mit Ihrem Code im Kundenportal gelangen Sie direkt zu Ihrem Vertrag.",
            "Vertrag ansehen und unterschreiben",
            "Bei Fragen antworten Sie einfach auf diese E-Mail.",
            "Guten Tag", "Freundliche Grüße"),
        EN("Your contract to sign", "Your contract from %s to sign",
            "Your contract is ready to sign",
            "Your contract is ready. Please read it at your leisure and then sign it online.",
            "%s has sent you a contract. Please read it at your leisure and then sign it online.",
            "After signing in to the customer portal with your code you will go straight to your contract.",
            "View and sign contract",
            "If you have any questions, simply reply to this email.",
            "Hello", "Kind regards");

        private final String subject;
        private final String subjectWith;
        private final String heading;
        private final String intro;
        private final String introWith;
        private final String portal;
        private final String button;
        private final String reply;
        private final String greeting;
        private final String signOff;

        @SuppressWarnings("checkstyle:ParameterNumber")
        Copy(String subject, String subjectWith, String heading, String intro, String introWith, String portal,
             String button, String reply, String greeting, String signOff) {
            this.subject = subject;
            this.subjectWith = subjectWith;
            this.heading = heading;
            this.intro = intro;
            this.introWith = introWith;
            this.portal = portal;
            this.button = button;
            this.reply = reply;
            this.greeting = greeting;
            this.signOff = signOff;
        }
    }
}
