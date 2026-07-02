package com.photographplatform.api.common.security;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Resolves the originating client IP from proxy headers, falling back to the
 * socket address. Centralises the extraction logic that used to be duplicated
 * across controllers (rate limiting + audit both need the real caller IP).
 */
public final class ClientIp {

    private ClientIp() {
    }

    public static String from(HttpServletRequest request) {
        // X-Forwarded-For is a comma-separated chain (client, proxy1, proxy2…);
        // the first entry is the original client.
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String real = request.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) {
            return real;
        }
        return request.getRemoteAddr();
    }
}
