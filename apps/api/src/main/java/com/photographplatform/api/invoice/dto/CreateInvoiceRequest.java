package com.photographplatform.api.invoice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * Buyer contact comes from the booking (client name/email), not this
 * request — a photographer shouldn't be able to redirect an invoice to an
 * arbitrary address. Buyer postal address is optional: neither {@code
 * Client} nor {@code Booking} captures one yet, so it's supplied per-invoice
 * when the photographer has it on hand.
 */
public record CreateInvoiceRequest(
    @NotEmpty @Valid List<CreateInvoiceLineItemRequest> lineItems,
    String buyerAddressLine1,
    String buyerAddressLine2,
    String buyerPostalCode,
    String buyerCity,
    String buyerCountry,
    String buyerReference,
    String paymentTerms
) {
}
