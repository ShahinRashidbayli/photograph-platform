package com.photographplatform.api.invoice.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

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
    UUID stornoOfId,
    String pdfDownloadUrl,
    OffsetDateTime issuedAt,
    List<InvoiceLineItemResponse> lineItems
) {
}
