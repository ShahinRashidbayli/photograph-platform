package com.photographplatform.api.notification.service;

import com.photographplatform.api.common.util.BusinessZone;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailRenderer;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.EmailTemplate.Row;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Renders the old German gallery expiry warning for rows already in the outbox.
 *
 * <p>Nothing queues it any more: the retention job publishes
 * {@code GalleryExpiringEvent}, and {@code messaging}'s Gallery expiring
 * replaced this one, in the Customer's language, addressed with <em>Sie</em>
 * and in the studio's name (#127). It stays registered for one release so rows
 * queued before that deploy still render. Delete it, and
 * {@link EmailType#GALLERY_EXPIRY}, in the release after.
 */
@Deprecated(forRemoval = true)
@Service
public class GalleryExpiryNotificationService
    implements EmailRenderer<GalleryExpiryNotificationService.Params> {

    @SuppressWarnings("checkstyle:ParameterNumber")
    public record Params(
        String clientName,
        String photographerName,
        String subdomain,
        String accessToken,
        OffsetDateTime expiresAt,
        int daysLeft) {}

    private static final DateTimeFormatter GERMAN_DATE =
        DateTimeFormatter.ofPattern("dd.MM.yyyy", Locale.GERMANY);

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    @Override
    public String template() {
        return "gallery.expiry-warning";
    }

    @Override
    @SuppressWarnings("removal") // both go in the same release
    public EmailType type() {
        return EmailType.GALLERY_EXPIRY;
    }

    @Override
    public Class<Params> paramsType() {
        return Params.class;
    }

    @Override
    public RenderedEmail render(Params params) {
        String clientName = params.clientName();
        String photographerName = params.photographerName();
        int daysLeft = params.daysLeft();
        String galleryUrl = webBaseUrl + "/g/" + params.subdomain() + "/" + params.accessToken();
        String expiryDate = params.expiresAt().atZoneSameInstant(BusinessZone.ID).format(GERMAN_DATE);

        String body = EmailTemplate.heading(headline(daysLeft))
            + EmailTemplate.paragraph("Hallo " + esc(clientName) + ",")
            + EmailTemplate.paragraph(
                "deine Galerie von <strong>" + esc(photographerName) + "</strong> steht noch bis zum "
                    + "<strong>" + expiryDate + "</strong> online. Danach wird sie automatisch "
                    + "entfernt.")
            + EmailTemplate.paragraph(
                "<strong>Bitte lade deine Fotos bis dahin herunter.</strong> Danach können wir sie "
                    + "dir nicht mehr zur Verfügung stellen.")
            + EmailTemplate.button("Galerie öffnen und herunterladen", galleryUrl)
            + EmailTemplate.infoTable(List.of(
                new Row("Fotograf:in", photographerName),
                new Row("Online bis", expiryDate),
                new Row("Verbleibende Tage", String.valueOf(daysLeft))))
            + EmailTemplate.note(
                "Du brauchst mehr Zeit? Wende dich an " + esc(photographerName)
                    + " — die Galerie kann verlängert werden.");

        return new RenderedEmail(
            subject(daysLeft, expiryDate), EmailTemplate.document(preheader(daysLeft), body));
    }

    private String headline(int daysLeft) {
        if (daysLeft <= 1) {
            return "Letzte Chance: deine Galerie wird morgen entfernt";
        }
        if (daysLeft <= 5) {
            return "Nur noch " + daysLeft + " Tage: bitte Fotos herunterladen";
        }
        return "Deine Galerie geht bald offline";
    }

    private String subject(int daysLeft, String expiryDate) {
        if (daysLeft <= 1) {
            return "⚠️ Letzte Erinnerung — deine Fotos sind nur noch bis morgen verfügbar";
        }
        if (daysLeft <= 5) {
            return "Nur noch " + daysLeft + " Tage: deine Fotogalerie bis " + expiryDate;
        }
        return "Deine Fotogalerie ist noch bis " + expiryDate + " online";
    }

    private String preheader(int daysLeft) {
        return daysLeft <= 1
            ? "Bitte lade deine Fotos heute noch herunter."
            : "Lade deine Fotos herunter, bevor die Galerie offline geht.";
    }

    /**
     * The template's block helpers escape plain arguments, but {@code
     * paragraph} and {@code note} accept inline HTML — a client name is
     * user-supplied, so anything interpolated into those has to be escaped
     * here, as the template's own javadoc requires.
     */
    private static String esc(String value) {
        return HtmlEscape.escape(value == null ? "" : value);
    }
}
