package com.photographplatform.api.contract.dto;

import jakarta.validation.constraints.Size;

/**
 * Creates a draft against a booking.
 *
 * <p>The recipient is not in this request. It comes from the booking, for the
 * same reason {@code CreateInvoiceRequest} leaves out the buyer contact: a
 * photographer must not be able to point a contract at an arbitrary address.
 *
 * <p>Both fields are optional. Omitting them asks the server for the starter
 * draft built from the booking and the tenant's legal details — the common
 * case, since writing a photography contract from an empty box is exactly the
 * task most photographers will not do.
 */
public record CreateContractRequest(
    @Size(max = 200) String title,
    String body
) {
}
