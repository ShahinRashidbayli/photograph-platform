package com.photographplatform.api.invoice.dto;

import java.math.BigDecimal;

public record InvoiceLineItemResponse(
    String description,
    BigDecimal quantity,
    Integer unitPriceCents,
    String taxCategory,
    BigDecimal taxRatePercent,
    Integer lineTotalCents
) {
}
