package com.photographplatform.api.contract.service;

import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.tenant.domain.Tenant;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * The starter text a new contract opens with.
 *
 * <p>Why a draft and not an empty box: a photographer asked to write a
 * photography contract from nothing will not do it, and the feature becomes a
 * text field nobody uses. The draft fills in what the system already knows —
 * the parties, the shoot, the fee — and leaves the photographer editing prose
 * rather than authoring it.
 *
 * <p>German, and deliberately so. Every party to these contracts is in the
 * German market (that is why the platform models {@code USt-IdNr.} and
 * Kleinunternehmer at all), and a contract is the one document where a
 * half-translated sentence is a liability rather than a rough edge. The
 * photographer can rewrite it in any language they like; what ships as the
 * default is the one the law it cites is written in.
 *
 * <p><b>This is a starting point, not legal advice.</b> The terms below are
 * ordinary commercial boilerplate — they are not reviewed by a lawyer, and the
 * UI says so where the photographer can see it before sending.
 */
public final class ContractDraftTemplate {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    private static final DecimalFormatSymbols MONEY_SYMBOLS =
        DecimalFormatSymbols.getInstance(Locale.GERMANY);

    private ContractDraftTemplate() {
    }

    public static String defaultTitle(Booking booking) {
        String type = blankToNull(booking.getEventType());
        return type == null ? "Fotografie-Vertrag" : "Fotografie-Vertrag — " + type;
    }

    public static String render(Booking booking, Tenant tenant) {
        StringBuilder b = new StringBuilder();

        b.append("FOTOGRAFIE-VERTRAG\n\n");

        b.append("Zwischen\n");
        b.append("  ")
            .append(orPlaceholder(tenant.getLegalName(),
                "[Ihr Name — bitte in den Einstellungen hinterlegen]"))
            .append("\n");
        String address = issuerAddress(tenant);
        if (address != null) {
            b.append("  ").append(address).append("\n");
        }
        b.append("  — nachfolgend „Fotograf\" —\n\n");

        b.append("und\n");
        b.append("  ").append(orPlaceholder(booking.getClientName(), "[Kunde]")).append("\n");
        if (blankToNull(booking.getClientEmail()) != null) {
            b.append("  ").append(booking.getClientEmail()).append("\n");
        }
        b.append("  — nachfolgend „Kunde\" —\n\n");

        b.append("1. LEISTUNG\n");
        b.append("Der Fotograf erbringt die folgende fotografische Leistung:\n");
        if (blankToNull(booking.getEventType()) != null) {
            b.append("  Anlass: ").append(booking.getEventType()).append("\n");
        }
        if (booking.getEventDate() != null) {
            b.append("  Termin: ").append(booking.getEventDate().format(DATE));
            if (booking.getEventTime() != null) {
                b.append(" um ").append(booking.getEventTime().format(TIME)).append(" Uhr");
            }
            b.append("\n");
        }
        if (blankToNull(booking.getLocation()) != null) {
            b.append("  Ort: ").append(booking.getLocation()).append("\n");
        }
        b.append("\n");

        b.append("2. VERGÜTUNG\n");
        if (booking.getTotalAmountCents() != null) {
            b.append("Das Honorar beträgt ").append(money(booking.getTotalAmountCents())).append(".\n");
            if (booking.getDepositAmountCents() != null && booking.getDepositAmountCents() > 0) {
                b.append("Davon ist eine Anzahlung in Höhe von ")
                    .append(money(booking.getDepositAmountCents()))
                    .append(" zur Reservierung des Termins fällig. ")
                    .append("Der Restbetrag ist nach der Lieferung der Bilder fällig.\n");
            }
        } else {
            b.append("Das Honorar beträgt [Betrag eintragen].\n");
        }
        b.append("\n");

        b.append("3. NUTZUNGSRECHTE\n");
        b.append("Der Fotograf räumt dem Kunden ein einfaches, zeitlich und räumlich ")
            .append("unbeschränktes Nutzungsrecht an den gelieferten Bildern für private Zwecke ein. ")
            .append("Eine kommerzielle Nutzung bedarf einer gesonderten schriftlichen Vereinbarung. ")
            .append("Das Urheberrecht verbleibt gemäß §13 UrhG beim Fotografen; ")
            .append("eine Bearbeitung der Bilder ist nur nach Absprache zulässig.\n\n");

        b.append("4. EIGENWERBUNG\n");
        b.append("Der Fotograf darf die Bilder zu Zwecken der Eigenwerbung (Portfolio, ")
            .append("Website, soziale Medien) verwenden, sofern der Kunde dem nicht widerspricht. ")
            .append("Ein Widerspruch ist jederzeit ohne Angabe von Gründen möglich.\n\n");

        b.append("5. AUSFALL UND RÜCKTRITT\n");
        b.append("Tritt der Kunde bis 30 Tage vor dem Termin zurück, wird die Anzahlung erstattet. ")
            .append("Bei einem späteren Rücktritt verbleibt die Anzahlung als Aufwandsentschädigung ")
            .append("beim Fotografen. Kann der Fotograf den Termin aus von ihm zu vertretenden ")
            .append("Gründen nicht wahrnehmen, wird die Anzahlung vollständig erstattet.\n\n");

        b.append("6. DATENSCHUTZ\n");
        b.append("Die Verarbeitung personenbezogener Daten richtet sich nach der ")
            .append("Datenschutzerklärung des Fotografen.\n\n");

        b.append("Mit der elektronischen Unterzeichnung bestätigt der Kunde, ")
            .append("diesen Vertrag gelesen zu haben und mit seinem Inhalt einverstanden zu sein.\n");

        return b.toString();
    }

    /** The issuer's single-line postal address, or null when nothing is filled in. */
    public static String issuerAddress(Tenant tenant) {
        String street = blankToNull(tenant.getLegalStreet());
        String postal = blankToNull(tenant.getLegalPostalCode());
        String city = blankToNull(tenant.getLegalCity());
        StringBuilder out = new StringBuilder();
        if (street != null) {
            out.append(street);
        }
        if (postal != null || city != null) {
            if (out.length() > 0) {
                out.append(", ");
            }
            if (postal != null) {
                out.append(postal);
            }
            if (city != null) {
                if (postal != null) {
                    out.append(' ');
                }
                out.append(city);
            }
        }
        return out.length() == 0 ? null : out.toString();
    }

    private static String money(int cents) {
        DecimalFormat format = new DecimalFormat("#,##0.00", MONEY_SYMBOLS);
        return format.format(cents / 100.0) + " €";
    }

    private static String orPlaceholder(String value, String placeholder) {
        String trimmed = blankToNull(value);
        return trimmed == null ? placeholder : trimmed;
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
