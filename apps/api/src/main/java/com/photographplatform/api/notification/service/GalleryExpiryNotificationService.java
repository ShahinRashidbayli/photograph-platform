package com.photographplatform.api.notification.service;

import com.photographplatform.api.common.util.BusinessZone;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.email.EmailTemplate.Row;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Warns the <em>client</em> that their gallery is about to come down.
 *
 * <p>ADR-001 §4.1 makes this a precondition for deleting anything: "the
 * dashboard countdown is <em>not</em> sufficient: a client who never opens the
 * dashboard sees nothing at all, and photos then vanish silently. The client —
 * not only the photographer — must be warned."
 *
 * <p>Written in German. The recipient is the photographer's customer in the
 * German market, and they never chose a language in our UI — the photographer
 * did. English here would reach someone who may not read it, about their own
 * wedding photos being deleted.
 */
@Service
public class GalleryExpiryNotificationService {

    private static final DateTimeFormatter GERMAN_DATE =
        DateTimeFormatter.ofPattern("dd.MM.yyyy", Locale.GERMANY);

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    private final EmailService emailService;

    public GalleryExpiryNotificationService(EmailService emailService) {
        this.emailService = emailService;
    }

    /**
     * @param daysLeft which warning this is, in days before expiry — it decides
     *                 the tone, because "in two weeks" and "tomorrow" are not
     *                 the same message about someone's wedding photos
     */
    public void sendExpiryWarning(
        String clientEmail,
        String clientName,
        String photographerName,
        String subdomain,
        String accessToken,
        OffsetDateTime expiresAt,
        int daysLeft) {

        String galleryUrl = webBaseUrl + "/g/" + subdomain + "/" + accessToken;
        String expiryDate = expiresAt.atZoneSameInstant(BusinessZone.ID).format(GERMAN_DATE);

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

        emailService.send(new EmailMessage(
            clientEmail,
            subject(daysLeft, expiryDate),
            EmailTemplate.document(preheader(daysLeft), body)));
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
