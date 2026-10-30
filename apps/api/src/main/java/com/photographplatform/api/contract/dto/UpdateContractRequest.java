package com.photographplatform.api.contract.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Rewrites a draft. Accepted only while the contract is still a draft. */
public record UpdateContractRequest(
    @NotBlank @Size(max = 200) String title,
    @NotBlank String body
) {
}
