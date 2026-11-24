package com.photographplatform.api.analytics.dto;

import java.util.List;

/**
 * One fiscal year of the studio's numbers.
 *
 * <p>Both screens are served from one response on purpose. Revenue and bookings
 * are the same events counted two ways — an invoice exists because a booking
 * happened — so splitting them into two endpoints would mean two round trips
 * that can disagree with each other whenever one is a month stale.
 *
 * <p>Every figure is derived from rows the studio already has. Nothing here is
 * estimated, projected or smoothed: a reporting screen that invents a trend is
 * worse than one that says the year is half empty.
 *
 * @param year          the fiscal year these figures cover
 * @param availableYears years the studio has any data in, newest first, so the
 *                      picker offers real choices instead of a fixed range
 */
public record AnalyticsResponse(
    int year,
    List<Integer> availableYears,
    RevenueSummary revenue,
    BookingSummary bookings
) {

    /**
     * Money, in cents: Invoiced and Collected, as invoice's
     * {@code SettlementPeriods} counts them (ADR-004 §3). Named "revenue" on
     * the wire only; the screen labels each figure by its own name.
     *
     * @param invoicedCents  Invoiced: every document issued in the year, net of
     *                       Storno, as the DATEV export books it. A Storniert
     *                       original stays in its own month and its Storno
     *                       counts against the Storno's month
     * @param collectedCents Collected: the payments that succeeded in the year,
     *                       by the month the money arrived (cash basis). A
     *                       December invoice paid in January is next year's
     * @param outstandingCents what is still Outstanding on the Live invoices
     *                       issued in the year, wherever their payments fell.
     *                       No longer invoiced minus collected: with Collected
     *                       on cash basis the two cover different invoices
     * @param invoiceCount   Live invoices issued in the year: neither a Storno
     *                       nor Storniert
     * @param averageInvoiceCents the mean total of those Live invoices
     * @param months         twelve entries, January first, zero-filled, by
     *                       Europe/Berlin month — a month
     *                       with no invoices is a fact about the year, and
     *                       dropping it would silently rescale the chart
     */
    public record RevenueSummary(
        long invoicedCents,
        long collectedCents,
        long outstandingCents,
        int invoiceCount,
        long averageInvoiceCents,
        List<MonthlyAmount> months
    ) {
    }

    /**
     * @param month 1-12
     */
    public record MonthlyAmount(int month, long invoicedCents, long collectedCents) {
    }

    /**
     * The work itself.
     *
     * @param byStatus       how many bookings sit in each status, so a studio can
     *                       see cancellations against completions
     * @param months         bookings per month by event date, zero-filled
     * @param topPackages    which packages actually sell, biggest first
     * @param leadsReceived  leads created in the year
     * @param leadsConverted of those, how many became a booking — counted through
     *                       {@code bookings.lead_id} rather than by matching
     *                       email, because the same person may enquire twice
     */
    public record BookingSummary(
        int total,
        List<StatusCount> byStatus,
        List<MonthlyCount> months,
        List<PackageCount> topPackages,
        int leadsReceived,
        int leadsConverted,
        /**
         * Who shot what, biggest first — the question a studio owner asks as
         * soon as there is more than one photographer. Empty for a studio that
         * never assigns, and carries an "unassigned" row when some bookings
         * have no photographer, because hiding those would make the numbers
         * fail to add up to the total above.
         */
        List<PhotographerCount> byPhotographer
    ) {
    }

    /**
     * @param name null for the unassigned bucket, so a client renders its own
     *             wording rather than matching on a magic string
     */
    public record PhotographerCount(String name, int count, long revenueCents) {
    }

    public record StatusCount(String status, int count) {
    }

    public record MonthlyCount(int month, int count) {
    }

    public record PackageCount(String name, int count, long revenueCents) {
    }
}
