package com.photographplatform.api.invoice.domain;

import java.util.List;

/**
 * One year of a studio's money, counted in the periods ADR-004 §3 sets, as
 * {@code SettlementPeriods} derives it. Never stored.
 *
 * @param months twelve entries, January first, zero-filled, by Europe/Berlin
 *     month: a month with nothing in it is a fact about the year
 * @param liveInvoiceCount the Live invoices issued in the year. A Storno and
 *     the invoice it withdrew are one correction, not two more sales
 * @param liveInvoiceTotalCents the summed totals of those Live invoices
 * @param outstandingCents what is still Outstanding on those Live invoices
 *     today, in whichever year their payments arrived
 */
public record YearSettlement(
    List<Month> months,
    int liveInvoiceCount,
    long liveInvoiceTotalCents,
    long outstandingCents
) {

    /**
     * @param month 1-12
     * @param invoicedCents Invoiced: every document issued in the month, as
     *     the DATEV export books it. A Storniert original stays +X in its own
     *     month and its Storno is −X in the Storno's month
     * @param collectedCents Collected: the payments that succeeded in the
     *     month, whichever invoice and year they paid
     */
    public record Month(int month, long invoicedCents, long collectedCents) {
    }

    // The year's totals are summed from its months rather than carried beside
    // them, so a report can never show a year that disagrees with its months.

    public long invoicedCents() {
        return months.stream().mapToLong(Month::invoicedCents).sum();
    }

    public long collectedCents() {
        return months.stream().mapToLong(Month::collectedCents).sum();
    }

    /** The mean total of the year's Live invoices; zero for a year without any. */
    public long averageLiveInvoiceCents() {
        return liveInvoiceCount == 0 ? 0 : liveInvoiceTotalCents / liveInvoiceCount;
    }
}
