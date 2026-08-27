package com.photographplatform.api.branding.dto;

/**
 * A studio's client-facing identity.
 *
 * <p>Served two ways from one shape: to the owner on the settings screen, and
 * to anonymous visitors on a portfolio or gallery. The public reader gets the
 * same fields because there is nothing private here — a logo and a colour are
 * things the studio is publishing on purpose.
 *
 * @param logoUrl        a pre-signed view URL, regenerated per response because
 *                       it expires; null when no logo is set
 * @param brandColor     `#RRGGBB`, or null for the surface's own default
 * @param whiteLabel     whether the plan lets the platform's name come off.
 *                       Sent rather than inferred from the presence of a logo:
 *                       a studio can upload one and still be on a plan that
 *                       keeps "Powered by Fotolio" underneath it
 */
public record BrandingResponse(
    String logoUrl,
    String brandColor,
    boolean whiteLabel
) {
}
