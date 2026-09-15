package com.photographplatform.api.contract.service;

import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.contract.domain.Contract;
import com.photographplatform.api.contract.domain.ContractStatus;
import java.time.format.DateTimeFormatter;

/**
 * Builds the contract PDF's source HTML. Same convention as
 * {@code InvoicePdfTemplate} and {@code EmailTemplate}: hand-written strings
 * with every interpolated value escaped, since all of it traces back to user
 * input.
 */
public final class ContractPdfTemplate {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private ContractPdfTemplate() {
    }

    public static String render(Contract contract) {
        StringBuilder html = new StringBuilder();
        html.append("<html><head><meta charset=\"utf-8\"/><style>")
            .append(css())
            .append("</style></head><body>");

        html.append("<h1>").append(esc(contract.getTitle())).append("</h1>");

        // The body is plain text the photographer wrote. Escaped and wrapped in
        // <pre> rather than parsed as markup: rendering their prose as HTML
        // would mean a stray "<" silently eats the rest of a clause, and this
        // is a document whose exact wording is the whole point.
        html.append("<pre class=\"body\">").append(esc(contract.getBody())).append("</pre>");

        html.append(signatureBlock(contract));

        html.append("</body></html>");
        return html.toString();
    }

    /**
     * The signature block — the part that makes the PDF worth keeping.
     *
     * <p>An unsigned contract gets an explicit "not yet signed" notice instead
     * of an empty space. A blank area at the foot of a contract reads as a
     * place to print and sign by hand, and someone would.
     */
    private static String signatureBlock(Contract contract) {
        if (contract.getStatus() != ContractStatus.SIGNED) {
            return "<div class=\"sig pending\"><strong>Noch nicht unterzeichnet.</strong> "
                + "Dieses Dokument ist ein Entwurf und entfaltet keine Bindungswirkung.</div>";
        }

        StringBuilder sig = new StringBuilder();
        sig.append("<div class=\"sig\">");
        sig.append("<div class=\"sig-title\">Elektronisch unterzeichnet</div>");
        sig.append("<table>");
        sig.append(row("Unterzeichnet von", contract.getSignerName()));
        sig.append(row("E-Mail", contract.getRecipientEmail()));
        if (contract.getSignedAt() != null) {
            sig.append(row("Zeitpunkt", contract.getSignedAt().format(STAMP) + " Uhr"));
        }
        // The hash is printed so the document carries its own means of
        // verification: re-hash the text, compare, done — no access to our
        // database required by whoever is checking.
        sig.append(row("Prüfsumme (SHA-256)", contract.getBodySha256()));
        sig.append("</table>");
        sig.append("<p class=\"note\">Einfache elektronische Signatur im Sinne von "
            + "Art. 3 Nr. 10 eIDAS-Verordnung. Die Prüfsumme bezieht sich auf den "
            + "Vertragstext zum Zeitpunkt der Unterzeichnung.</p>");
        sig.append("</div>");
        return sig.toString();
    }

    private static String row(String label, String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return "<tr><th>" + esc(label) + "</th><td>" + esc(value) + "</td></tr>";
    }

    private static String css() {
        return """
            @page { size: A4; margin: 20mm 18mm; }
            body { font-family: 'ContractSans', sans-serif; font-size: 10.5pt; color: #111; }
            h1 { font-size: 15pt; margin: 0 0 14pt; }
            pre.body {
                font-family: 'ContractSans', sans-serif;
                font-size: 10.5pt;
                line-height: 1.55;
                white-space: pre-wrap;
                word-wrap: break-word;
                margin: 0;
            }
            .sig {
                margin-top: 22pt;
                border: 1pt solid #333;
                padding: 10pt 12pt;
                page-break-inside: avoid;
            }
            .sig.pending { border-style: dashed; color: #666; }
            .sig-title { font-weight: 700; margin-bottom: 6pt; }
            .sig table { border-collapse: collapse; }
            .sig th {
                text-align: left;
                font-weight: 400;
                color: #555;
                padding: 2pt 14pt 2pt 0;
                vertical-align: top;
                white-space: nowrap;
            }
            .sig td { padding: 2pt 0; word-break: break-all; }
            .note { font-size: 8.5pt; color: #555; margin: 8pt 0 0; line-height: 1.4; }
            """;
    }

    private static String esc(String value) {
        return value == null ? "" : HtmlEscape.escape(value);
    }
}
