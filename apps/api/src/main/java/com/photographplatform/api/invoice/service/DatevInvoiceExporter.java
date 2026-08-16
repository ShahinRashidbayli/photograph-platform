package com.photographplatform.api.invoice.service;

import com.photographplatform.api.invoice.domain.Invoice;
import com.photographplatform.api.invoice.domain.InvoiceLineItem;
import com.photographplatform.api.invoice.domain.TaxCategory;
import com.photographplatform.api.invoice.repository.InvoiceLineItemRepository;
import com.photographplatform.api.tenant.domain.TaxMode;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.UncheckedIOException;
import java.nio.charset.Charset;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

/**
 * Exports issued invoices as a DATEV EXTF "Buchungsstapel" (posting batch)
 * CSV — format/Kennzeichen 21, version 700, per DATEV's published format
 * description. No DATEV certification is required for this format (unlike
 * LODAS, which is payroll and does require it).
 *
 * <p><strong>Account numbers are SKR03 placeholders</strong> (debtor 10000,
 * revenue 8400/19% or 8337/§19 Kleinunternehmer) — every real deployment
 * needs its Steuerberater to confirm or replace these before the export is
 * trusted, exactly as the roadmap's own sprint gate requires ("Steuerberater
 * CSV-ni qəbul edir"). This exporter gets the structural shape right; the
 * chart-of-accounts mapping is a professional call, not a code one.
 */
@Service
public class DatevInvoiceExporter {

    private static final Charset DATEV_CHARSET = Charset.forName("windows-1252");
    private static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final DateTimeFormatter BELEGDATUM = DateTimeFormatter.ofPattern("ddMM");

    private static final String DEBTOR_ACCOUNT = "10000";
    private static final String REVENUE_ACCOUNT_STANDARD = "8400";
    private static final String REVENUE_ACCOUNT_KLEINUNTERNEHMER = "8337";

    private final InvoiceLineItemRepository lineItemRepository;

    public DatevInvoiceExporter(InvoiceLineItemRepository lineItemRepository) {
        this.lineItemRepository = lineItemRepository;
    }

    public void write(OutputStream out, List<Invoice> invoices, int fiscalYear, String businessName) {
        // DATEV requires Windows-1252 (not UTF-8) and CRLF line endings — a
        // plain PrintWriter with '\n' would produce a file DATEV's importer
        // rejects outright, not just mis-renders.
        PrintWriter writer = new PrintWriter(new java.io.OutputStreamWriter(out, DATEV_CHARSET));
        try {
            writer.print(header(fiscalYear, businessName));
            writer.print(CRLF);
            writer.print(columnHeaderRow());
            writer.print(CRLF);
            for (Invoice invoice : invoices) {
                writer.print(dataRow(invoice));
                writer.print(CRLF);
            }
            writer.flush();
        } finally {
            // Caller owns `out` — flush only, no close, matching the
            // controller's response-stream lifecycle (see LeadCsvExporter).
        }
        if (writer.checkError()) {
            throw new UncheckedIOException(new IOException("Failed writing DATEV export"));
        }
    }

    private static final String CRLF = "\r\n";

    private String header(int fiscalYear, String businessName) {
        String now = OffsetDateTime.now().format(TIMESTAMP);
        // "EXTF";700;21;"Buchungsstapel";13;<created>;;"";"";<Berater>;<Mandant>;
        // <WJ-Beginn ddMMyyyy>;<Sachkontenlänge>;<von ddMMyyyy>;<bis ddMMyyyy>;
        // "<Bezeichnung>";"";1;0;0;"EUR"
        // Berater-/Mandanten-Nummer left at 0 — every real DATEV client has
        // its own, assigned by the Steuerberater, not something this app can
        // default sensibly.
        return "\"EXTF\";700;21;\"Buchungsstapel\";13;" + now + ";;;;0;0;"
            + fiscalYear + "0101;4;" + fiscalYear + "0101;" + fiscalYear + "1231;\""
            + field(businessName) + "\";\"\";1;0;0;\"EUR\"";
    }

    private String columnHeaderRow() {
        return String.join(";", List.of(
            "\"Umsatz (ohne Soll/Haben-Kz)\"",
            "\"Soll/Haben-Kennzeichen\"",
            "\"WKZ Umsatz\"",
            "\"Kurs\"",
            "\"Basis-Umsatz\"",
            "\"WKZ Basis-Umsatz\"",
            "\"Konto\"",
            "\"Gegenkonto (ohne BU-Schlüssel)\"",
            "\"BU-Schlüssel\"",
            "\"Belegdatum\"",
            "\"Belegfeld 1\"",
            "\"Belegfeld 2\"",
            "\"Skonto\"",
            "\"Buchungstext\""
        ));
    }

    private String dataRow(Invoice invoice) {
        // A Storno's amounts are already negative in our model; DATEV instead
        // expresses a reversal as a positive amount with the opposite
        // Soll/Haben-Kennzeichen, so both must flip together here.
        boolean isReversal = invoice.getTotalCents() < 0;
        long absTotal = Math.abs(invoice.getTotalCents());
        String amount = amount(absTotal);
        String sollHaben = isReversal ? "S" : "H";
        String revenueAccount = invoice.getTaxMode() == TaxMode.KLEINUNTERNEHMER
            ? REVENUE_ACCOUNT_KLEINUNTERNEHMER
            : REVENUE_ACCOUNT_STANDARD;
        String buSchluessel = buSchluessel(invoice);
        String belegdatum = invoice.getIssuedAt().format(BELEGDATUM);
        String buchungstext = "Rechnung " + invoice.getInvoiceNumber() + " " + invoice.getBuyerName();

        return String.join(";", List.of(
            amount,
            sollHaben,
            "", "", "", "",
            DEBTOR_ACCOUNT,
            revenueAccount,
            buSchluessel,
            belegdatum,
            quoted(invoice.getInvoiceNumber()),
            "",
            "",
            quoted(buchungstext)
        ));
    }

    /**
     * SKR03 automatic-VAT-posting key: "3" flags the revenue account for
     * automatic 19% VAT posting, "2" for 7%, blank for tax-exempt
     * (Kleinunternehmer). These are the standard SKR03 keys, but the correct
     * key ultimately depends on the tenant's actual chart of accounts.
     *
     * <p>An invoice is exported as a single posting row (one amount, one
     * account, one key) regardless of how many line items it has, so a
     * genuinely mixed-rate invoice (some 19% lines, some 7%) still can't be
     * represented exactly — that would need one row per rate, a bigger
     * redesign than this fix. This picks "3" whenever any line is taxed at
     * the standard rate (the conservative choice on a mix) and only uses "2"
     * when every taxable line is REDUCED.
     */
    private String buSchluessel(Invoice invoice) {
        if (invoice.getTaxMode() == TaxMode.KLEINUNTERNEHMER || invoice.getTaxCents() == 0) {
            return "";
        }
        List<InvoiceLineItem> lines = lineItemRepository.findByInvoiceIdOrderBySortOrderAsc(invoice.getId());
        boolean hasStandard = lines.stream().anyMatch(l -> l.getTaxCategory() == TaxCategory.STANDARD);
        boolean hasReduced = lines.stream().anyMatch(l -> l.getTaxCategory() == TaxCategory.REDUCED);
        if (!hasStandard && hasReduced) {
            return "2";
        }
        return "3";
    }

    private static String amount(long absCents) {
        long euros = absCents / 100;
        long cents = absCents % 100;
        return String.format(Locale.GERMANY, "%d,%02d", euros, cents);
    }

    private static String quoted(String value) {
        return "\"" + field(value) + "\"";
    }

    /**
     * Neutralizes CSV formula injection: a value starting with {@code =},
     * {@code +}, {@code -} or {@code @} is interpreted as a formula by
     * Excel/LibreOffice when the export is opened rather than imported
     * straight into DATEV — free-text tenant/customer fields (business name,
     * buyer name) flow through here unvalidated, so a value like {@code
     * =HYPERLINK(...)} must not reach the file as-is. Prefixing a tab keeps
     * the value's own leading character intact for a human reading the CSV,
     * while stopping spreadsheet software from treating it as a formula.
     */
    private static String field(String value) {
        if (value == null) {
            return "";
        }
        String escaped = value.replace("\"", "'");
        if (!escaped.isEmpty() && "=+-@".indexOf(escaped.charAt(0)) >= 0) {
            escaped = "\t" + escaped;
        }
        return escaped;
    }
}
