package com.photographplatform.api.messaging.application;

import java.nio.charset.StandardCharsets;
import org.springframework.web.util.UriUtils;

/**
 * The public gallery, {@code /g/{subdomain}/{token}}: the one link both
 * gallery messages carry.
 *
 * <p>Not through the Customer sign-in, unlike the portal links: the token is
 * the capability, and the gallery is meant to open for whoever the Customer
 * forwards it to, the family included.
 */
final class GalleryLink {

    private GalleryLink() {
    }

    static String of(String webBaseUrl, String subdomain, String accessToken) {
        return webBaseUrl + "/g/" + UriUtils.encodePathSegment(subdomain, StandardCharsets.UTF_8)
            + "/" + UriUtils.encodePathSegment(accessToken, StandardCharsets.UTF_8);
    }
}
