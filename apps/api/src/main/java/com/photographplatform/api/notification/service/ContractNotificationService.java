package com.photographplatform.api.notification.service;

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

    public record Params(UUID contractId, UUID bookingId, String title, String signerName) {}

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
            new Params(event.getContractId(), event.getBookingId(), event.getTitle(), event.getSignerName()),
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
        return new RenderedEmail("✍️ Contract signed — " + params.title(), buildBody(params));
    }

    private String buildBody(Params event) {
        // The signer's typed name is customer input; EmailTemplate escapes
        // everything it renders, so it is passed through raw rather than
        // double-escaped — same as the lead notifier.
        return EmailTemplate.document(
            "Contract signed — " + event.title(),
            EmailTemplate.badge("SIGNED", Tone.SUCCESS)
                + EmailTemplate.heading("Your contract was signed")
                + EmailTemplate.infoTable(List.of(
                    new EmailTemplate.Row("Contract", event.title()),
                    new EmailTemplate.Row("Signed by", event.signerName())))
                // The booking detail is the list with ?id=; there is no
                // /bookings/{id} page, and that link landed on a 404 (#104).
                + EmailTemplate.button("Open the booking",
                    webBaseUrl.replaceAll("/+$", "") + "/bookings?id=" + event.bookingId())
                + EmailTemplate.note("Contract ID: " + event.contractId()));
    }
}
