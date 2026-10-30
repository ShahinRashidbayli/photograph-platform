package com.photographplatform.api.contract.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * The customer's signature.
 *
 * <p>{@code typedName} is the signature itself — a simple electronic signature
 * under eIDAS Art. 3(10) is the signatory's own act of adopting the document,
 * and typing your name is that act.
 *
 * <p>{@code agreed} must be true. It is not decoration: consent has to be an
 * affirmative act the signer took, so a request that reaches the server without
 * it is refused rather than being treated as agreement by default.
 */
public record SignContractRequest(
    @NotBlank @Size(max = 200) String typedName,
    @AssertTrue(message = "You must confirm that you agree to this contract") boolean agreed
) {
}
