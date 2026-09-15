package com.photographplatform.api.common.domain;

/**
 * Which business a euro came from.
 *
 * <p>Today there is exactly one answer, which is precisely why this exists now.
 * Every payment the platform handles moves <b>client → photographer</b>: a
 * deposit or a balance against a booking. From studio rental onward (ADR-003
 * §6) money also moves <b>photographer → photographer</b>, and that is a
 * different business — different counterparty (a business, not a consumer),
 * different VAT treatment, and a platform fee taken for a different reason than
 * the Starter commission.
 *
 * <p>{@code AnalyticsService} sums issued invoices into a single figure called
 * <i>revenue</i>. Once both sources exist, that figure answers neither question
 * unless the rows say where they came from — and by then the rows that could
 * have said it are already written. Recording it while there is one value is a
 * column; splitting it afterwards is a migration over data that has forgotten.
 *
 * <p>In {@code common} rather than in {@code invoice} or {@code payment}
 * because it classifies both, and because which businesses this platform runs
 * is a platform fact rather than a document's own.
 */
public enum RevenueSource {

    /** A client paying their photographer — deposits, balances, invoices. */
    CLIENT_BOOKING,

    /**
     * One tenant paying another through the platform — studio rental, coaching,
     * workshops. Nothing writes this yet; the marketplace does (ADR-003 §6).
     */
    MARKETPLACE
}
