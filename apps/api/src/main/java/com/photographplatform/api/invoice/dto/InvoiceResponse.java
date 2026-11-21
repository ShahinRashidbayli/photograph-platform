package com.photographplatform.api.invoice.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * An invoice as both audiences see it, settlement figures included.
 *
 * <p>{@code paidCents}/{@code outstandingCents} are here rather than left to
 * the payment-summary endpoint because every screen that lists invoices needs
 * them for every row. Fetching a summary per row made the client issue one HTTP
 * request per invoice — the same N+1 the server-side listing had already been
 * fixed for, reintroduced one layer up. The server computes them in a single
 * grouped query it was making anyway.
 *
 * <p>They are derived, not stored: a payment row settling is what changes them,
 * and an invoice itself is immutable (GoBD). All of them are Settlement's; a
 * screen renders them and never works out Live, Collectable or Overdue itself
 * (ADR-004).
 */
public record InvoiceResponse(
    UUID id,
    UUID bookingId,
    String invoiceNumber,
    String status,
    String taxMode,
    String buyerName,
    String buyerEmail,
    String currency,
    Integer subtotalCents,
    Integer taxCents,
    Integer totalCents,
    /** Sum of SUCCEEDED payments against this invoice. */
    Integer paidCents,
    /** {@code totalCents - paidCents}, floored at zero; zero unless the invoice is Live. */
    Integer outstandingCents,
    /** The day it is to be paid by; {@code null} unless the invoice is Live. */
    LocalDate dueDate,
    /** Neither a Storno nor Storniert: the only kind a Customer can owe money on. */
    boolean live,
    /** Live with something Outstanding: whether a pay action belongs on it at all. */
    boolean collectable,
    /** Collectable with its Due date passed. */
    boolean overdue,
    /** Bank-transfer reference, e.g. {@code RE-2026-0001}. */
    String verwendungszweck,
    UUID stornoOfId,
    String pdfDownloadUrl,
    OffsetDateTime issuedAt,
    List<InvoiceLineItemResponse> lineItems
) {
}
