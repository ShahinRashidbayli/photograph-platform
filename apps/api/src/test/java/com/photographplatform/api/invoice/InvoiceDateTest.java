package com.photographplatform.api.invoice;

import com.photographplatform.api.invoice.service.InvoiceDate;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The invoice date must not depend on who reads the timestamp.
 *
 * <p>It did: the PDF was rendered at issue time from an OffsetDateTime still
 * carrying the JVM's offset, while the DATEV export read the same row back
 * from Postgres in UTC. An invoice issued at 00:43 on 22 August printed
 * 22.08.2026 and posted with Belegdatum 2108 — one invoice, two dates, in the
 * two documents a tax advisor reconciles against each other.
 */
class InvoiceDateTest {

    /**
     * The exact instant that produced the mismatch, expressed the two ways the
     * two code paths saw it. Both must now resolve to the same calendar day.
     */
    @Test
    void isTheSameDayWhicheverOffsetTheTimestampArrivesIn() {
        OffsetDateTime asRendered = OffsetDateTime.parse("2026-08-22T00:43:37+04:00");
        OffsetDateTime asReadBack = asRendered.withOffsetSameInstant(ZoneOffset.UTC);

        assertThat(asReadBack.toLocalDate())
            .as("precondition: the raw values really do disagree")
            .isNotEqualTo(asRendered.toLocalDate());

        assertThat(InvoiceDate.of(asRendered))
            .isEqualTo(InvoiceDate.of(asReadBack));
    }

    /**
     * Berlin is an hour or two ahead of UTC, so late-evening UTC instants are
     * already the next day for the business — including across a month
     * boundary, where the wrong answer moves the invoice into the previous VAT
     * period.
     */
    @Test
    void usesTheBusinessDayNotTheUtcDay() {
        // 2026-08-31T23:30Z is 2026-09-01T01:30 in Berlin (CEST, +02:00).
        OffsetDateTime lateAugustUtc = OffsetDateTime.parse("2026-08-31T23:30:00Z");

        assertThat(InvoiceDate.of(lateAugustUtc))
            .as("the business issued this in September; posting it to August "
                + "would file it in the wrong VAT period")
            .isEqualTo(LocalDate.of(2026, 9, 1));
    }

    /**
     * The storno notice cites the invoice it cancels ("Storno-Rechnung zu
     * Rechnung X vom …"). It read the original's raw timestamp, so a
     * cancellation could print a different date than the invoice it cancels
     * shows on itself — two documents contradicting each other inside one GoBD
     * record set.
     */
    @Test
    void datesTheCancelledInvoiceTheSameWayThatInvoiceDatesItself() {
        OffsetDateTime original = OffsetDateTime.parse("2026-08-22T00:43:37+04:00");

        assertThat(InvoiceDate.of(original))
            .isEqualTo(InvoiceDate.of(original.withOffsetSameInstant(ZoneOffset.UTC)));
    }

    /** Winter: Berlin is CET (+01:00), so the same reasoning holds with one hour. */
    @Test
    void handlesTheWinterOffsetToo() {
        OffsetDateTime lateDecemberUtc = OffsetDateTime.parse("2026-12-31T23:30:00Z");

        assertThat(InvoiceDate.of(lateDecemberUtc))
            .as("a fixed +02:00 would get this right by luck; a fixed offset "
                + "gets one of the two seasons wrong")
            .isEqualTo(LocalDate.of(2027, 1, 1));
    }
}
