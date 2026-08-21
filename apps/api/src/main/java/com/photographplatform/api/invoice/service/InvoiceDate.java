package com.photographplatform.api.invoice.service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;

/**
 * The calendar date an invoice was issued, in the business's own timezone.
 *
 * <h2>Why this is not just {@code getIssuedAt().toLocalDate()}</h2>
 * {@code issued_at} is an instant, and the same instant lands on different
 * calendar days depending on who converts it. That was not hypothetical: an
 * invoice issued at 00:43 local time printed <em>22.08.2026</em> on the PDF —
 * rendered at issue time from an OffsetDateTime still carrying the JVM's
 * +04:00 — while the DATEV export, which reads the row back from Postgres and
 * gets it in UTC, posted the same invoice with Belegdatum <em>21.08</em>. One
 * invoice, two dates, in the two documents a tax advisor reconciles against
 * each other.
 *
 * <p>The PDF's date was not reliably right either: it followed whatever
 * timezone the server ran in, so the date printed on a legal document moved
 * between a developer's laptop and a UTC container.
 *
 * <p>Belegdatum decides the posting period. At a month boundary this is not a
 * cosmetic off-by-one — an invoice issued just after midnight on the 1st gets
 * posted into the previous month, and therefore into the previous VAT period.
 *
 * <p>So the date is derived once, here, in a fixed zone. Germany is the
 * product's market (EUR, §14 UStG, DATEV/GoBD), and the invoice date that
 * matters is the one the issuing business would write on it.
 */
public final class InvoiceDate {

    /**
     * Handles CET/CEST automatically, which a fixed UTC+1 offset would not.
     */
    public static final ZoneId BUSINESS_ZONE = ZoneId.of("Europe/Berlin");

    private InvoiceDate() {
    }

    /**
     * @param issuedAt the invoice's {@code issued_at} instant, in whatever
     *                 offset it happens to arrive in — that is the whole point
     */
    public static LocalDate of(OffsetDateTime issuedAt) {
        return issuedAt.atZoneSameInstant(BUSINESS_ZONE).toLocalDate();
    }
}
