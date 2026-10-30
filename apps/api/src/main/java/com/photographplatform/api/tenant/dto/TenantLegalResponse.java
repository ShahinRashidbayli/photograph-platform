package com.photographplatform.api.tenant.dto;

/**
 * A photographer's legal identity as shown on their own public pages.
 *
 * <p>Every field here is already public by law — an Impressum exists precisely
 * so visitors can see who they are dealing with — so this DTO is safe to serve
 * unauthenticated from {@code /api/public/legal/{subdomain}}. Nothing that is
 * not part of the statutory disclosure belongs in it.
 *
 * @param complete whether the mandatory §5 DDG fields are all filled in.
 *                 The public page reads this to decide between rendering the
 *                 Impressum and telling the visitor it has not been published
 *                 yet — silently rendering a half-empty Impressum would be
 *                 worse than admitting the gap, because it looks compliant.
 */
public record TenantLegalResponse(
    String subdomain,
    String legalName,
    String legalStreet,
    String legalPostalCode,
    String legalCity,
    String legalCountry,
    String legalEmail,
    String legalPhone,
    String legalVatId,
    String legalRegister,
    String legalResponsible,
    String privacyContactEmail,
    boolean complete
) {

    /**
     * The public answer for a photographer who has not finished their details:
     * the subdomain and nothing else.
     *
     * <p>"Public by law" only holds for a disclosure the photographer has
     * actually published. A half-filled draft is a private home address they
     * typed into a settings form and have not stood behind yet — and since the
     * public pages refuse to render a partial Impressum anyway, serving the
     * fields would put them within reach of anyone walking the subdomain list
     * while showing them to no legitimate visitor.
     */
    public static TenantLegalResponse unpublished(String subdomain) {
        return new TenantLegalResponse(subdomain,
            null, null, null, null, null, null, null, null, null, null, null, false);
    }
}
