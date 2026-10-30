package com.photographplatform.api.auth.service;

import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * Single source of truth for the access/refresh cookie attributes.
 * Both photographer and customer auth flows must produce identical
 * cookies (same name, attrs, TTL) so the JWT filter and refresh endpoint
 * stay role-agnostic.
 */
@Component
public class AuthCookieWriter {

    public static final String ACCESS_TOKEN_COOKIE  = "access_token";
    public static final String REFRESH_TOKEN_COOKIE = "refresh_token";

    private final long accessTokenExpiryMs;
    private final long refreshTokenExpiryMs;
    private final boolean cookieSecure;
    private final String cookieSameSite;
    private final String cookieDomain;

    public AuthCookieWriter(
        @Value("${app.jwt.access-token-expiry-ms}") long accessTokenExpiryMs,
        @Value("${app.jwt.refresh-token-expiry-ms}") long refreshTokenExpiryMs,
        @Value("${app.cookie.secure:false}") boolean cookieSecure,
        @Value("${app.cookie.same-site:Lax}") String cookieSameSite,
        @Value("${app.cookie.domain:}") String cookieDomain
    ) {
        this.accessTokenExpiryMs = accessTokenExpiryMs;
        this.refreshTokenExpiryMs = refreshTokenExpiryMs;
        this.cookieSecure = cookieSecure;
        this.cookieSameSite = cookieSameSite;
        this.cookieDomain = cookieDomain;
    }

    public void setAuthCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        long accessMaxAge = Duration.ofMillis(accessTokenExpiryMs).getSeconds();
        long refreshMaxAge = Duration.ofMillis(refreshTokenExpiryMs).getSeconds();
        response.addHeader(HttpHeaders.SET_COOKIE,
            buildCookie(ACCESS_TOKEN_COOKIE, accessToken, accessMaxAge).toString());
        response.addHeader(HttpHeaders.SET_COOKIE,
            buildCookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshMaxAge).toString());
    }

    public void clearAuthCookies(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(ACCESS_TOKEN_COOKIE, "", 0).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(REFRESH_TOKEN_COOKIE, "", 0).toString());
    }

    private ResponseCookie buildCookie(String name, String value, long maxAgeSeconds) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
            .httpOnly(true)
            .secure(cookieSecure)
            .sameSite(cookieSameSite)
            .path("/")
            .maxAge(maxAgeSeconds);
        if (cookieDomain != null && !cookieDomain.isBlank()) {
            builder.domain(cookieDomain);
        }
        return builder.build();
    }
}
