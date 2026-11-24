package com.photographplatform.api.analytics.dto;

/**
 * The dashboard's three money figures for the current Europe/Berlin calendar
 * year, in cents (GLOSSARY.md). Each is named for what it counts: "revenue" has
 * meant all three at different times (ADR-004 §4).
 *
 * @param year           the calendar year these figures cover
 * @param bookedCents    Booked: the quoted value of the Billable bookings with
 *                       an event this year, whether or not it has passed yet
 * @param invoicedCents  Invoiced so far this year, net of Storno; the same
 *                       figure as the analytics report's year total
 * @param collectedCents Collected so far this year, by the month the money
 *                       arrived; the same figure as the analytics report's
 */
public record YearSummaryResponse(
    int year,
    long bookedCents,
    long invoicedCents,
    long collectedCents
) {
}
