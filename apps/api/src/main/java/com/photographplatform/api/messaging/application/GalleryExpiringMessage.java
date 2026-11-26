package com.photographplatform.api.messaging.application;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.util.BusinessZone;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.gallery.event.GalleryExpiringEvent;
import com.photographplatform.api.messaging.domain.CustomerMessageLayout;
import com.photographplatform.api.messaging.domain.StudioIdentity;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Gallery expiring: the studio warns a Customer, in its own name and in the
 * Customer's language, that their gallery comes down on a given day, so they
 * download their photos in time (ADR-001 §4.1).
 *
 * <p>Sent by the retention job, 15, 5 and 1 days before expiry. The reminder
 * row the job writes in the same transaction is what stops a second warning
 * for the same threshold. Expires with the gallery: a warning that arrives
 * after the photos are gone is only distressing.
 *
 * <p>Replaces the German-only {@code gallery.expiry-warning}, which said
 * <em>du</em> and was marked {@code lang="en"}.
 */
@Service
public class GalleryExpiringMessage implements EmailRenderer<GalleryExpiringMessage.Params> {

    /** Stored in queued rows; must not change. */
    public static final String TEMPLATE = "messaging.gallery-expiring";

    /**
     * @param studio       who speaks, frozen at queue time
     * @param language     the Customer's
     * @param customerName how the studio knows them; may be blank
     * @param galleryUrl   the public gallery, {@code /g/{subdomain}/{token}}
     * @param expiresAt    when the gallery comes down
     * @param daysLeft     which warning this is; decides the tone
     */
    public record Params(StudioIdentity studio, CustomerLanguage language, String customerName,
                         String galleryUrl, OffsetDateTime expiresAt, int daysLeft) {}

    private final CustomerMessageQueue queue;
    private final String webBaseUrl;

    public GalleryExpiringMessage(CustomerMessageQueue queue,
                                  @Value("${app.web.base-url:http://localhost:3000}") String webBaseUrl) {
        this.queue = queue;
        this.webBaseUrl = webBaseUrl;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onGalleryExpiring(GalleryExpiringEvent event) {
        String galleryUrl = GalleryLink.of(webBaseUrl, event.getSubdomain(), event.getAccessToken());
        queue.queue(new CustomerMessageQueue.Message(
            TEMPLATE,
            EmailType.GALLERY_EXPIRING,
            event.getGalleryId(),
            event.getTenantId(),
            event.getRecipientEmail(),
            studio -> new Params(studio, event.getLanguage(), event.getRecipientName(), galleryUrl,
                event.getExpiresAt(), event.getDaysLeft()),
            event.getExpiresAt()));
    }

    @Override
    public String template() {
        return TEMPLATE;
    }

    @Override
    public EmailType type() {
        return EmailType.GALLERY_EXPIRING;
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

        int daysLeft = params.daysLeft();
        String date = params.expiresAt().atZoneSameInstant(BusinessZone.ID).format(copy.date);
        String strongDate = "<strong>" + date + "</strong>";
        String subject;
        String heading;
        if (daysLeft <= 1) {
            subject = copy.lastSubject.formatted(date);
            heading = copy.lastHeading;
        } else if (daysLeft <= 5) {
            subject = copy.soonSubject.formatted(daysLeft, date);
            heading = copy.soonHeading.formatted(daysLeft);
        } else {
            subject = copy.subject.formatted(date);
            heading = copy.heading;
        }

        String body = CustomerMessageLayout.heading(heading)
            + CustomerMessageLayout.paragraph(greeting)
            + CustomerMessageLayout.paragraph(name == null
                ? copy.intro.formatted(strongDate)
                : copy.introWith.formatted(escapedName, strongDate))
            + CustomerMessageLayout.paragraph(copy.download)
            + CustomerMessageLayout.button(studio, copy.button, params.galleryUrl())
            + CustomerMessageLayout.paragraph(copy.moreTime)
            + CustomerMessageLayout.paragraph(signOff);

        return new RenderedEmail(subject,
            CustomerMessageLayout.document(studio, params.language(), heading, body));
    }

    /**
     * The fixed copy, addressed with <em>Sie</em>. {@code introWith} takes the
     * studio's name; {@code intro} stands in while a studio has none.
     */
    private enum Copy {
        DE(DateTimeFormatter.ofPattern("dd.MM.yyyy", Locale.GERMANY),
            "Ihre Fotos sind noch bis %s online",
            "Nur noch %d Tage: Ihre Fotos sind bis %s online",
            "Letzte Erinnerung: Ihre Fotos sind nur noch bis %s online",
            "Ihre Galerie geht bald offline",
            "Nur noch %d Tage: Bitte laden Sie Ihre Fotos herunter",
            "Letzte Erinnerung: Ihre Galerie geht offline",
            "Ihre Galerie ist noch bis zum %s online. Danach wird sie automatisch entfernt.",
            "Ihre Galerie von %s ist noch bis zum %s online. Danach wird sie automatisch entfernt.",
            "Bitte laden Sie Ihre Fotos bis dahin herunter.",
            "Galerie öffnen und Fotos herunterladen",
            "Sie brauchen mehr Zeit? Antworten Sie einfach auf diese E-Mail.",
            "Guten Tag", "Freundliche Grüße"),
        EN(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.ENGLISH),
            "Your photos are online until %s",
            "Only %d days left: your photos are online until %s",
            "Last reminder: your photos are online only until %s",
            "Your gallery is going offline soon",
            "Only %d days left: please download your photos",
            "Last reminder: your gallery is going offline",
            "Your gallery is online until %s. After that it will be removed automatically.",
            "Your gallery from %s is online until %s. After that it will be removed automatically.",
            "Please download your photos before then.",
            "Open gallery and download photos",
            "Need more time? Simply reply to this email.",
            "Hello", "Kind regards");

        private final DateTimeFormatter date;
        private final String subject;
        private final String soonSubject;
        private final String lastSubject;
        private final String heading;
        private final String soonHeading;
        private final String lastHeading;
        private final String intro;
        private final String introWith;
        private final String download;
        private final String button;
        private final String moreTime;
        private final String greeting;
        private final String signOff;

        @SuppressWarnings("checkstyle:ParameterNumber")
        Copy(DateTimeFormatter date, String subject, String soonSubject, String lastSubject, String heading,
             String soonHeading, String lastHeading, String intro, String introWith, String download,
             String button, String moreTime, String greeting, String signOff) {
            this.date = date;
            this.subject = subject;
            this.soonSubject = soonSubject;
            this.lastSubject = lastSubject;
            this.heading = heading;
            this.soonHeading = soonHeading;
            this.lastHeading = lastHeading;
            this.intro = intro;
            this.introWith = introWith;
            this.download = download;
            this.button = button;
            this.moreTime = moreTime;
            this.greeting = greeting;
            this.signOff = signOff;
        }
    }
}
