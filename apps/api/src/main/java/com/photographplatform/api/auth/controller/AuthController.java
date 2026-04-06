package com.photographplatform.api.auth.controller;

import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.MeResponse;
import com.photographplatform.api.auth.dto.RefreshRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.auth.service.AuthService;
import com.photographplatform.api.common.exception.UnauthorizedException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Arrays;
import java.util.UUID;
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
    private static final int ACCESS_TOKEN_MAX_AGE  = 24 * 60 * 60;       // 24 h in seconds
    private static final int REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;  // 30 d in seconds

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(
        @Valid @RequestBody RegisterRequest request,
        HttpServletResponse response
    ) {
        AuthResponse auth = authService.register(request);
        setAuthCookies(response, auth.accessToken(), auth.refreshToken());
        return auth;
    }

    @PostMapping("/login")
    public AuthResponse login(
        @Valid @RequestBody LoginRequest request,
        HttpServletResponse response
    ) {
        AuthResponse auth = authService.login(request);
        setAuthCookies(response, auth.accessToken(), auth.refreshToken());
        return auth;
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(
        @RequestBody(required = false) RefreshRequest body,
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        String refreshToken = resolveRefreshToken(body, request);
        AuthResponse auth = authService.refresh(new RefreshRequest(refreshToken));
        setAuthCookies(response, auth.accessToken(), auth.refreshToken());
        return auth;
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(
        @AuthenticationPrincipal String userId,
        HttpServletResponse response
    ) {
        authService.logout(UUID.fromString(userId));
        clearAuthCookies(response);
    }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal String userId) {
        if (userId == null) {
            throw new UnauthorizedException("Authentication required");
        }
        return authService.me(UUID.fromString(userId));
    }

    // ── cookie helpers ────────────────────────────────────────────────────────

    private void setAuthCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        response.addHeader(HttpHeaders.SET_COOKIE,
            buildCookie(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_TOKEN_MAX_AGE).toString());
        response.addHeader(HttpHeaders.SET_COOKIE,
            buildCookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_MAX_AGE).toString());
    }

    private void clearAuthCookies(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(ACCESS_TOKEN_COOKIE, "", 0).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(REFRESH_TOKEN_COOKIE, "", 0).toString());
    }

    private ResponseCookie buildCookie(String name, String value, int maxAgeSeconds) {
        return ResponseCookie.from(name, value)
            .httpOnly(true)
            .secure(false)   // set to true behind HTTPS in production
            .sameSite("Lax")
            .path("/")
            .maxAge(maxAgeSeconds)
            .build();
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
