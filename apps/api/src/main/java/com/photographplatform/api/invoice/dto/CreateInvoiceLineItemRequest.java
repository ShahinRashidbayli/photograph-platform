package com.photographplatform.api.invoice.dto;

import com.photographplatform.api.invoice.domain.TaxCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CreateInvoiceLineItemRequest(
    @NotBlank String description,
    // Matches the NUMERIC(10,2) column. A third decimal was rounded on save but
    // not in the totals or the PDF, so the issued invoice (and any Storno
    // copied from it) disagreed with its own stored row — and it cannot be
    // corrected once issued.
    @NotNull @DecimalMin(value = "0.01") @Digits(integer = 8, fraction = 2) BigDecimal quantity,
    @NotNull @Min(0) Integer unitPriceCents,
    @NotNull TaxCategory taxCategory
) {
}
