package com.photographplatform.api.auth.controller;

import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.AuthResult;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.MeResponse;
import com.photographplatform.api.auth.dto.RefreshRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.auth.dto.VerifyEmailRequest;
import com.photographplatform.api.auth.service.AuthService;
import com.photographplatform.api.auth.service.EmailVerificationService;
import com.photographplatform.api.common.exception.UnauthorizedException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.Arrays;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String ACCESS_TOKEN_COOKIE  = "access_token";
    private static final String REFRESH_TOKEN_COOKIE = "refresh_token";

    private final AuthService authService;
    private final EmailVerificationService emailVerificationService;
    private final long accessTokenExpiryMs;
    private final long refreshTokenExpiryMs;
    private final boolean cookieSecure;
    private final String cookieSameSite;
    private final String cookieDomain;

    public AuthController(
        AuthService authService,
        EmailVerificationService emailVerificationService,
        @Value("${app.jwt.access-token-expiry-ms}") long accessTokenExpiryMs,
        @Value("${app.jwt.refresh-token-expiry-ms}") long refreshTokenExpiryMs,
        @Value("${app.cookie.secure:false}") boolean cookieSecure,
        @Value("${app.cookie.same-site:Lax}") String cookieSameSite,
        @Value("${app.cookie.domain:}") String cookieDomain
    ) {
        this.authService = authService;
        this.emailVerificationService = emailVerificationService;
        this.accessTokenExpiryMs = accessTokenExpiryMs;
        this.refreshTokenExpiryMs = refreshTokenExpiryMs;
        this.cookieSecure = cookieSecure;
        this.cookieSameSite = cookieSameSite;
        this.cookieDomain = cookieDomain;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(
        @Valid @RequestBody RegisterRequest request,
        HttpServletRequest httpRequest,
        HttpServletResponse response
    ) {
        AuthResult result = authService.register(request, resolveClientIp(httpRequest));
        setAuthCookies(response, result.accessToken(), result.refreshToken());
        return result.response();
    }

    @PostMapping("/login")
    public AuthResponse login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest httpRequest,
        HttpServletResponse response
    ) {
        AuthResult result = authService.login(request, resolveClientIp(httpRequest));
        setAuthCookies(response, result.accessToken(), result.refreshToken());
        return result.response();
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(
        @RequestBody(required = false) RefreshRequest body,
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        String refreshToken = resolveRefreshToken(body, request);
        AuthResult result = authService.refresh(new RefreshRequest(refreshToken));
        setAuthCookies(response, result.accessToken(), result.refreshToken());
        return result.response();
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(
        @AuthenticationPrincipal String userId,
        HttpServletResponse response
    ) {
        // Idempotent — safe to call even when no user is authenticated.
        if (userId != null && !userId.isBlank()) {
            try {
                authService.logout(UUID.fromString(userId));
            } catch (IllegalArgumentException ignored) {
                // Malformed principal — nothing to invalidate, still clear cookies.
            }
        }
        clearAuthCookies(response);
    }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal String userId) {
        if (userId == null || userId.isBlank()) {
            throw new UnauthorizedException("Authentication required");
        }
        try {
            return authService.me(UUID.fromString(userId));
        } catch (IllegalArgumentException ex) {
            throw new UnauthorizedException("Authentication required");
        }
    }

    @PostMapping("/verify-email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        emailVerificationService.verify(request.token());
    }

    @PostMapping("/resend-verification")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resendVerification(
        @AuthenticationPrincipal String userId,
        HttpServletRequest httpRequest
    ) {
        if (userId == null || userId.isBlank()) {
            throw new UnauthorizedException("Authentication required");
        }
        try {
            emailVerificationService.resend(UUID.fromString(userId), resolveClientIp(httpRequest));
        } catch (IllegalArgumentException ex) {
            throw new UnauthorizedException("Authentication required");
        }
    }

    // ── cookie helpers ────────────────────────────────────────────────────────

    private void setAuthCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        long accessMaxAge = Duration.ofMillis(accessTokenExpiryMs).getSeconds();
        long refreshMaxAge = Duration.ofMillis(refreshTokenExpiryMs).getSeconds();
        response.addHeader(HttpHeaders.SET_COOKIE,
            buildCookie(ACCESS_TOKEN_COOKIE, accessToken, accessMaxAge).toString());
        response.addHeader(HttpHeaders.SET_COOKIE,
            buildCookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshMaxAge).toString());
    }

    private void clearAuthCookies(HttpServletResponse response) {
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

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String resolveRefreshToken(RefreshRequest body, HttpServletRequest request) {
        if (body != null && body.refreshToken() != null && !body.refreshToken().isBlank()) {
            return body.refreshToken();
        }
        if (request.getCookies() != null) {
            return Arrays.stream(request.getCookies())
                .filter(c -> REFRESH_TOKEN_COOKIE.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElseThrow(() -> new UnauthorizedException("No refresh token provided"));
        }
        throw new UnauthorizedException("No refresh token provided");
    }
}
