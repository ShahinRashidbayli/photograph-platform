package com.photographplatform.api.tenant.dto;

import com.photographplatform.api.tenant.domain.TaxMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * The invoice issuer's legal identity, as §14 UStG requires it to appear on
 * every invoice this tenant issues.
 *
 * <p>{@code taxId} (Steuernummer) and {@code vatId} (USt-IdNr.) are both
 * optional <em>individually</em> but not together — §14 Abs. 4 Nr. 2 wants at
 * least one, which is a cross-field rule and so lives in the service rather
 * than in an annotation here.
 */
public record BillingProfileRequest(
    @NotBlank(message = "business name is required")
    @Size(max = 200)
    String businessName,

    @NotBlank(message = "street address is required")
    @Size(max = 200)
    String addressLine1,

    @Size(max = 200)
    String addressLine2,

    @NotBlank(message = "postal code is required")
    @Size(max = 20)
    String postalCode,

    @NotBlank(message = "city is required")
    @Size(max = 100)
    String city,

    @NotBlank(message = "country is required")
    @Pattern(regexp = "^[A-Za-z]{2}$", message = "country must be a 2-letter ISO code, e.g. DE")
    String country,

    @Size(max = 50)
    String taxId,

    @Size(max = 50)
    String vatId,

    @NotNull(message = "tax mode is required")
    TaxMode taxMode
) {
}
