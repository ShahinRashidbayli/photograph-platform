package com.photographplatform.api.tenant.dto;

/**
 * @param complete whether every §14 UStG field is filled in — the single flag
 *                 the UI needs to explain why invoicing is blocked, without
 *                 re-implementing the statute in TypeScript
 */
public record BillingProfileResponse(
    String businessName,
    String addressLine1,
    String addressLine2,
    String postalCode,
    String city,
    String country,
    String taxId,
    String vatId,
    String taxMode,
    boolean complete
) {
}
