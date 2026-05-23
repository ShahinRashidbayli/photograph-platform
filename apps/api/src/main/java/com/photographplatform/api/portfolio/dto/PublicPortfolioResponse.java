package com.photographplatform.api.portfolio.dto;

import java.util.List;

/**
 * Combined payload for the public portfolio page so a single request renders
 * the entire view. Saves a round-trip and lets the page SSR cleanly.
 */
public record PublicPortfolioResponse(
    PhotographerPublic photographer,
    List<PhotoResponse> photos
) {
    public record PhotographerPublic(
        String subdomain,
        String displayName,
        String plan,
        String avatarUrl
    ) {
    }
}
