package com.photographplatform.api.invoice.dto;

import com.photographplatform.api.invoice.domain.TaxCategory;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CreateInvoiceLineItemRequest(
    @NotBlank String description,
    @NotNull @DecimalMin(value = "0.01") BigDecimal quantity,
    @NotNull @Min(0) Integer unitPriceCents,
    @NotNull TaxCategory taxCategory
) {
}
