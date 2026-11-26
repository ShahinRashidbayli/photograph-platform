package com.photographplatform.api.messaging.application;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.gallery.event.GalleryDeliveredEvent;
import com.photographplatform.api.messaging.domain.CustomerMessageLayout;
import com.photographplatform.api.messaging.domain.PersonalNote;
import com.photographplatform.api.messaging.domain.StudioIdentity;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.RenderedEmail;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Gallery ready: the studio tells a Customer, in its own name and in the
 * Customer's language, that their photos are ready, with a link to the public
 * gallery.
 *
 * <p>Sent on every "An Kunden senden": each {@link GalleryDeliveredEvent}
 * carries its own {@code sentAt}, so each click is one outbox row
 * ({@code GALLERY_READY:galleryId:sentAt}).
 *
 * <p>Can carry the photographer's {@link PersonalNote}, always escaped. Queued
 * before commit in the send's transaction (ADR-005): a send that rolls back
 * tells nobody.
 */
@Service
public class GalleryReadyMessage implements EmailRenderer<GalleryReadyMessage.Params> {

    /** Stored in queued rows; must not change. */
    public static final String TEMPLATE = "messaging.gallery-ready";

    /**
     * @param studio       who speaks, frozen at queue time
     * @param language     the Customer's
     * @param customerName how the studio knows them; may be blank
     * @param galleryUrl   the public gallery, {@code /g/{subdomain}/{token}}
     * @param note         the photographer's personal note, unescaped; null for none
     */
    public record Params(StudioIdentity studio, CustomerLanguage language, String customerName,
                         String galleryUrl, String note) {}

    private final CustomerMessageQueue queue;
    private final String webBaseUrl;

    public GalleryReadyMessage(CustomerMessageQueue queue,
                               @Value("${app.web.base-url:http://localhost:3000}") String webBaseUrl) {
        this.queue = queue;
        this.webBaseUrl = webBaseUrl;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onGalleryDelivered(GalleryDeliveredEvent event) {
        String galleryUrl = GalleryLink.of(webBaseUrl, event.getSubdomain(), event.getAccessToken());
        queue.queue(new CustomerMessageQueue.Message(
            TEMPLATE,
            EmailType.GALLERY_READY,
            event.getGalleryId(),
            event.getTenantId(),
            event.getRecipientEmail(),
            studio -> new Params(studio, event.getLanguage(), event.getRecipientName(), galleryUrl,
                event.getNote()),
            null,
            event.getSentAt()));
    }

    @Override
    public String template() {
        return TEMPLATE;
    }

    @Override
    public EmailType type() {
        return EmailType.GALLERY_READY;
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
            + CustomerMessageLayout.personalNote(studio, PersonalNote.ofNullable(params.note()))
            + CustomerMessageLayout.button(studio, copy.button, params.galleryUrl())
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
        DE("Ihre Galerie ist bereit", "Ihre Galerie von %s ist bereit",
            "Ihre Fotos sind da",
            "Ihre Galerie ist fertig. Sie können Ihre Fotos ab sofort online ansehen.",
            "%s hat Ihre Galerie fertiggestellt. Sie können Ihre Fotos ab sofort online ansehen.",
            "Galerie öffnen",
            "Bei Fragen antworten Sie einfach auf diese E-Mail.",
            "Guten Tag", "Freundliche Grüße"),
        EN("Your gallery is ready", "Your gallery from %s is ready",
            "Your photos are here",
            "Your gallery is ready. You can view your photos online now.",
            "%s has finished your gallery. You can view your photos online now.",
            "Open gallery",
            "If you have any questions, simply reply to this email.",
            "Hello", "Kind regards");

        private final String subject;
        private final String subjectWith;
        private final String heading;
        private final String intro;
        private final String introWith;
        private final String button;
        private final String reply;
        private final String greeting;
        private final String signOff;

        @SuppressWarnings("checkstyle:ParameterNumber")
        Copy(String subject, String subjectWith, String heading, String intro, String introWith,
             String button, String reply, String greeting, String signOff) {
            this.subject = subject;
            this.subjectWith = subjectWith;
            this.heading = heading;
            this.intro = intro;
            this.introWith = introWith;
            this.button = button;
            this.reply = reply;
            this.greeting = greeting;
            this.signOff = signOff;
        }
    }
}
