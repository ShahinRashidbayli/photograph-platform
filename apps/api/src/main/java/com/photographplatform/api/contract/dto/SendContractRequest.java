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
    // Same limit as messaging's PersonalNote.MAX_LENGTH, which this module may
    // not import (messaging listens to contract, not the other way round).
    // Checked here so an over-long note is a 400 now, not a message that
    // fails to render later.
    @Size(max = 1000, message = "A personal note is at most 1000 characters")
    String note
) {}
