package com.photographplatform.api.common.logging;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.servlet.HandlerMapping;

/**
 * Names a request by its route template, never by its URI.
 *
 * <p>The URI is not safe to log: the Customer's gallery link is
 * {@code /api/public/galleries/{subdomain}/{token}}, and that token is the
 * whole of the access control on the gallery. A raw URI in a log line hands
 * the gallery to anyone who can read the logs. The template names the same
 * endpoint without the values.
 */
public final class RequestRoute {

    /** A request no controller claimed — rejected by a filter first, or a path this build does not have. */
    public static final String UNMATCHED = "unmatched";

    /**
     * The pattern the static-resource handler matches everything it is offered
     * with. It is what an unknown path ends up "matched" by, so it means the
     * same as no match at all.
     */
    private static final String CATCH_ALL = "/**";

    private RequestRoute() {
    }

    public static String of(HttpServletRequest request) {
        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        if (pattern == null || CATCH_ALL.equals(pattern.toString())) {
            return UNMATCHED;
        }
        return pattern.toString();
    }
}
