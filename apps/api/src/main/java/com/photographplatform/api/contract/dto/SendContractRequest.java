package com.photographplatform.api.contract.dto;

import jakarta.validation.constraints.Size;

/**
 * Optional payload for {@code POST /api/contracts/{id}/send} and
 * {@code …/resend}.
 *
 * @param note the photographer's optional personal note to the Customer, sent
 *             with the contract as plain text; never stored on the contract
 */
public record SendContractRequest(
    @Size(max = 1000, message = "A personal note is at most 1000 characters")
    String note
) {}
