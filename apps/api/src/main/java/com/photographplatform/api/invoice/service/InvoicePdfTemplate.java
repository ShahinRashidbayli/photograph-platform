package com.photographplatform.api.invoice.service;

import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.invoice.domain.Invoice;
import com.photographplatform.api.invoice.domain.InvoiceLineItem;
import com.photographplatform.api.tenant.domain.TaxMode;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Builds the invoice PDF's source HTML. Same convention as {@code
 * EmailTemplate}: hand-written strings, not a templating engine, with every
 * interpolated value escaped since names/addresses ultimately trace back to
 * user input.
 */
public final class InvoicePdfTemplate {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final DecimalFormatSymbols MONEY_SYMBOLS = DecimalFormatSymbols.getInstance(Locale.GERMANY);

    private InvoicePdfTemplate() {
    }

    public static String render(Invoice invoice, List<InvoiceLineItem> lines, Invoice stornoTarget) {
        StringBuilder rows = new StringBuilder();
        for (InvoiceLineItem line : lines) {
            String quantity = line.getQuantity().stripTrailingZeros().toPlainString();
            String taxRate = line.getTaxRatePercent().stripTrailingZeros().toPlainString();
            rows.append("<tr>")
                .append("<td>").append(esc(line.getDescription())).append("</td>")
                .append("<td class=\"num\">").append(quantity).append("</td>")
                .append("<td class=\"num\">").append(money(line.getUnitPriceCents())).append("</td>")
                .append("<td class=\"num\">").append(taxRate).append("%</td>")
                .append("<td class=\"num\">").append(money(line.getLineTotalCents())).append("</td>")
                .append("</tr>");
        }

        String stornoNotice = stornoTarget != null
            ? "<p class=\"notice\">Storno-Rechnung zu Rechnung <strong>" + esc(stornoTarget.getInvoiceNumber())
                + "</strong> vom "
                // Through InvoiceDate, like every other invoice date: citing
                // the original from its raw timestamp let a storno claim a
                // different date than the invoice it cancels prints on itself.
                + InvoiceDate.of(stornoTarget.getIssuedAt()).format(DATE) + ".</p>"
            : "";

        String kleinunternehmerNotice = invoice.getTaxMode() == TaxMode.KLEINUNTERNEHMER
            ? "<p class=\"notice\">Gemäß § 19 Abs. 1 UStG wird keine Umsatzsteuer berechnet.</p>"
            : "";

        String issuerVat = invoice.getIssuerVatId() != null
            ? "USt-IdNr.: " + esc(invoice.getIssuerVatId()) + "<br/>"
            : "";
        String issuerTax = invoice.getIssuerTaxId() != null
            ? "Steuernummer: " + esc(invoice.getIssuerTaxId()) + "<br/>"
            : "";

        return "<html><head><meta charset=\"utf-8\"/><style>" + CSS + "</style></head><body>"
            + "<div class=\"header\">"
            + "<div class=\"issuer\">"
            + "<strong>" + esc(invoice.getIssuerBusinessName()) + "</strong><br/>"
            + esc(invoice.getIssuerAddressLine1()) + "<br/>"
            + (invoice.getIssuerAddressLine2() != null ? esc(invoice.getIssuerAddressLine2()) + "<br/>" : "")
            + esc(invoice.getIssuerPostalCode()) + " " + esc(invoice.getIssuerCity()) + "<br/>"
            + issuerTax + issuerVat
            + "</div>"
            + "<div class=\"meta\">"
            + "<h1>Rechnung " + esc(invoice.getInvoiceNumber()) + "</h1>"
            + "Rechnungsdatum: " + InvoiceDate.of(invoice.getIssuedAt()).format(DATE) + "<br/>"
            + (invoice.getBuyerReference() != null ? "Referenz: " + esc(invoice.getBuyerReference()) + "<br/>" : "")
            + "</div>"
            + "</div>"
            + "<div class=\"buyer\">"
            + esc(invoice.getBuyerName()) + "<br/>"
            + (invoice.getBuyerAddressLine1() != null ? esc(invoice.getBuyerAddressLine1()) + "<br/>" : "")
            + (invoice.getBuyerAddressLine2() != null ? esc(invoice.getBuyerAddressLine2()) + "<br/>" : "")
            + buyerCityLine(invoice)
            + "</div>"
            + stornoNotice
            + "<table class=\"lines\">"
            + "<thead><tr><th>Beschreibung</th><th class=\"num\">Menge</th><th class=\"num\">Einzelpreis</th>"
            + "<th class=\"num\">USt.</th><th class=\"num\">Betrag</th></tr></thead>"
            + "<tbody>" + rows + "</tbody>"
            + "</table>"
            + "<table class=\"totals\">"
            + "<tr><td>Zwischensumme</td><td class=\"num\">" + money(invoice.getSubtotalCents()) + " €</td></tr>"
            + "<tr><td>Umsatzsteuer</td><td class=\"num\">" + money(invoice.getTaxCents()) + " €</td></tr>"
            + "<tr class=\"grand\"><td>Gesamtbetrag</td><td class=\"num\">"
            + money(invoice.getTotalCents()) + " €</td></tr>"
            + "</table>"
            + kleinunternehmerNotice
            + paymentTermsLine(invoice)
            + "</body></html>";
    }

    private static String paymentTermsLine(Invoice invoice) {
        return invoice.getPaymentTerms() != null
            ? "<p class=\"notice\">" + esc(invoice.getPaymentTerms()) + "</p>"
            : "";
    }

    private static String buyerCityLine(Invoice invoice) {
        if (invoice.getBuyerPostalCode() == null && invoice.getBuyerCity() == null) {
            return "";
        }
        return esc(nullToEmpty(invoice.getBuyerPostalCode())) + " "
            + esc(nullToEmpty(invoice.getBuyerCity())) + "<br/>";
    }

    // DecimalFormat is documented as not thread-safe, and this template can
    // render concurrently (one call per issued/storno'd invoice, with no
    // synchronization around InvoiceService's use of it) — so each call gets
    // its own instance rather than sharing one across threads. DecimalFormatSymbols
    // itself is safe to share: we only ever read from it, never mutate it.
    private static String money(int cents) {
        DecimalFormat format = new DecimalFormat("#,##0.00", MONEY_SYMBOLS);
        return format.format(BigDecimal.valueOf(cents, 2));
    }

    private static String esc(String value) {
        return HtmlEscape.escape(value);
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static final String CSS = """
        @page { size: A4; margin: 2cm; }
        /* InvoiceSans is the embedded DejaVu registered by InvoicePdfRenderer.
           The base-14 Helvetica it replaced silently dropped every text run
           containing an umlaut, an ß or a € — i.e. most German invoices. */
        body { font-family: InvoiceSans, sans-serif; font-size: 10.5pt; color: #0F172A; }
        .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
        .issuer { font-size: 9pt; color: #475569; }
        .meta { text-align: right; }
        h1 { font-size: 16pt; margin: 0 0 8px; }
        .buyer { margin-bottom: 24px; }
        .notice { font-size: 9pt; color: #475569; margin: 12px 0; }
        table.lines { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        table.lines th, table.lines td { padding: 6px 4px; border-bottom: 1px solid #E2E8F0; text-align: left; }
        table.lines th.num, table.lines td.num { text-align: right; }
        table.totals { width: 40%; margin-left: 60%; border-collapse: collapse; }
        table.totals td { padding: 4px; }
        table.totals td.num { text-align: right; }
        table.totals tr.grand td { font-weight: bold; border-top: 1px solid #0F172A; padding-top: 8px; }
        """;
}
