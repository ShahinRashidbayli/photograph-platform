package com.photographplatform.api.notification.service;

import com.photographplatform.api.contract.event.ContractSignedEvent;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.EmailTemplate.Tone;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Tells the photographer their contract came back signed.
 *
 * <p>Same shape as {@link LeadNotificationService}: listens to the domain
 * event, emails best-effort, and never lets a mail failure disturb the thing
 * that actually happened. A signature is already stored and visible in the
 * dashboard by the time this runs — losing the email is an inconvenience, and
 * throwing here would turn it into a failed signing request for a customer who
 * did nothing wrong.
 */
@Service
public class ContractNotificationService {

    private static final Logger LOG = LoggerFactory.getLogger(ContractNotificationService.class);

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    private final EmailService emailService;

    public ContractNotificationService(EmailService emailService) {
        this.emailService = emailService;
    }

    @Async
    @EventListener
    public void onContractSigned(ContractSignedEvent event) {
        try {
            emailService.send(new EmailMessage(
                event.getPhotographerEmail(),
                "✍️ Contract signed — " + event.getTitle(),
                buildBody(event)
            ));
        } catch (Exception e) {
            LOG.error("Failed to send contract-signed notification for contract {}: {}",
                event.getContractId(), e.getMessage(), e);
        }
    }

    private String buildBody(ContractSignedEvent event) {
        // The signer's typed name is customer input; EmailTemplate escapes
        // everything it renders, so it is passed through raw rather than
        // double-escaped — same as the lead notifier.
        return EmailTemplate.document(
            "Contract signed — " + event.getTitle(),
            EmailTemplate.badge("SIGNED", Tone.SUCCESS)
                + EmailTemplate.heading("Your contract was signed")
                + EmailTemplate.infoTable(List.of(
                    new EmailTemplate.Row("Contract", event.getTitle()),
                    new EmailTemplate.Row("Signed by", event.getSignerName())))
                + EmailTemplate.button("Open the booking",
                    webBaseUrl + "/bookings/" + event.getBookingId())
                + EmailTemplate.note("Contract ID: " + event.getContractId()));
    }
}
