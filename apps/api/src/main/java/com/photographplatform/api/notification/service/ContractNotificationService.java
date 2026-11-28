package com.photographplatform.api.notification.service;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.contract.event.ContractSignedEvent;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.EmailTemplate.Tone;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Tells the photographer their contract came back signed.
 *
 * <p>Same shape as {@link LeadNotificationService}: listens to the domain
 * event and queues the email in the signature's transaction. Only the queueing
 * is in that transaction — a provider outage is retried by the outbox and can
 * never turn into a failed signing request for a customer who did nothing
 * wrong.
 */
@Service
public class ContractNotificationService implements EmailRenderer<ContractNotificationService.Params> {

    /** @param language the recipient's; null (a job queued before it existed) is German */
    public record Params(UUID contractId, UUID bookingId, String title, String signerName,
                         CustomerLanguage language) {}

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    private final EmailService emailService;

    public ContractNotificationService(EmailService emailService) {
        this.emailService = emailService;
    }

    /** Queued before commit, in the signature's own transaction (ADR-005). */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onContractSigned(ContractSignedEvent event) {
        emailService.queue(new OutgoingEmail(
            template(),
            event.getPhotographerEmail(),
            event.getTenantId(),
            new Params(event.getContractId(), event.getBookingId(), event.getTitle(), event.getSignerName(),
                event.getPhotographerLanguage()),
            EmailType.CONTRACT_SIGNED + ":" + event.getContractId(),
            null));
    }

    @Override
    public String template() {
        return "contract.signed";
    }

    @Override
    public EmailType type() {
        return EmailType.CONTRACT_SIGNED;
    }

    @Override
    public Class<Params> paramsType() {
        return Params.class;
    }

    @Override
    public RenderedEmail render(Params params) {
        Copy copy = params.language() == CustomerLanguage.EN ? Copy.EN : Copy.DE;
        return new RenderedEmail("✍️ " + copy.subject + " — " + params.title(), buildBody(copy, params));
    }

    private String buildBody(Copy copy, Params event) {
        // The signer's typed name is customer input; EmailTemplate escapes
        // everything it renders, so it is passed through raw rather than
        // double-escaped — same as the lead notifier.
        return EmailTemplate.document(
            copy.subject + " — " + event.title(),
            EmailTemplate.badge(copy.badge, Tone.SUCCESS)
                + EmailTemplate.heading(copy.heading)
                + EmailTemplate.infoTable(List.of(
                    new EmailTemplate.Row(copy.contract, event.title()),
                    new EmailTemplate.Row(copy.signedBy, event.signerName())))
                // The booking detail is the list with ?id=; there is no
                // /bookings/{id} page, and that link landed on a 404 (#104).
                + EmailTemplate.button(copy.button,
                    webBaseUrl.replaceAll("/+$", "") + "/bookings?id=" + event.bookingId())
                + EmailTemplate.note(copy.contractId + event.contractId()),
            event.language());
    }

    private enum Copy {
        DE("Vertrag unterschrieben", "Unterzeichnet", "Ihr Vertrag wurde unterschrieben", "Vertrag",
            "Unterschrieben von", "Buchung öffnen", "Vertrags-ID: "),
        EN("Contract signed", "Signed", "Your contract was signed", "Contract", "Signed by",
            "Open the booking", "Contract ID: ");

        private final String subject;
        private final String badge;
        private final String heading;
        private final String contract;
        private final String signedBy;
        private final String button;
        private final String contractId;

        Copy(String subject, String badge, String heading, String contract, String signedBy, String button,
             String contractId) {
            this.subject = subject;
            this.badge = badge;
            this.heading = heading;
            this.contract = contract;
            this.signedBy = signedBy;
            this.button = button;
            this.contractId = contractId;
        }
    }
}
