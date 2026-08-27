package com.photographplatform.api.portfolio.dto;

import com.photographplatform.api.branding.dto.BrandingResponse;
import java.util.List;

/**
 * Combined payload for the public portfolio page so a single request renders
 * the entire view. Saves a round-trip and lets the page SSR cleanly.
 */
public record PublicPortfolioResponse(
    PhotographerPublic photographer,
    List<PhotoResponse> photos,
    /**
     * The studio's own logo and colour, and whether its plan lets the
     * platform's name come off the footer. Served to anonymous visitors on
     * purpose — a logo is something the studio is publishing.
     */
    BrandingResponse branding
) {
    public record PhotographerPublic(
        String subdomain,
        String displayName,
        String plan,
        String avatarUrl
    ) {
    }
}
