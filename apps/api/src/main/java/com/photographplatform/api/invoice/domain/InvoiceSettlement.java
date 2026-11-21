package com.photographplatform.api.invoice.domain;

import com.photographplatform.api.common.exception.ConflictException;
import java.time.LocalDate;

/**
 * Where one invoice stands, as {@code Settlement} derives it. Never stored.
 *
 * @param paidCents the sum of its succeeded payments
 * @param outstandingCents its total less {@code paidCents}, never below zero;
 *     zero unless the invoice is Live
 * @param dueDate the day by which it is to be paid; {@code null} unless the
 *     invoice is Live, since a Storno and a Storniert invoice are never paid
 * @param collectable Live with something Outstanding
 * @param overdue Collectable, and its Due date has passed
 */
public record InvoiceSettlement(
    Invoice invoice, int paidCents, int outstandingCents, LocalDate dueDate, boolean collectable, boolean overdue) {

    /**
     * Refuses money for anything but a Live invoice. A Storniert invoice has
     * been legally withdrawn and its Storno already nets it to zero, so money
     * collected against it is money no document claims; a Storno is a
     * correction, not a bill. Neither payment path used to check this, so a
     * client sitting on a payment link could pay an invoice that had been
     * withdrawn underneath them.
     */
    public void requireLive() {
        if (invoice.getStatus() == InvoiceStatus.STORNIERT) {
            throw new ConflictException(
                "Invoice " + invoice.getInvoiceNumber() + " has been storniert and can no longer be paid");
        }
        if (invoice.getStornoOfId() != null) {
            throw new ConflictException(
                "Invoice " + invoice.getInvoiceNumber() + " is a Storno correction, not a payable invoice");
        }
    }
}
