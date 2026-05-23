package com.photographplatform.api.auth.controller;

import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.AuthResult;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.MeResponse;
import com.photographplatform.api.auth.dto.RefreshRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.auth.dto.UpdateProfileRequest;
import com.photographplatform.api.auth.dto.VerifyEmailRequest;
import com.photographplatform.api.auth.service.AuthCookieWriter;
import com.photographplatform.api.auth.service.AuthService;
import com.photographplatform.api.auth.service.EmailVerificationService;
import com.photographplatform.api.common.exception.UnauthorizedException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Arrays;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final EmailVerificationService emailVerificationService;
    private final AuthCookieWriter cookies;

    public AuthController(
        AuthService authService,
        EmailVerificationService emailVerificationService,
        AuthCookieWriter cookies
    ) {
        this.authService = authService;
        this.emailVerificationService = emailVerificationService;
        this.cookies = cookies;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(
        @Valid @RequestBody RegisterRequest request,
        HttpServletRequest httpRequest,
        HttpServletResponse response
    ) {
        AuthResult result = authService.register(request, resolveClientIp(httpRequest));
        cookies.setAuthCookies(response, result.accessToken(), result.refreshToken());
        return result.response();
    }

    @PostMapping("/login")
    public AuthResponse login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest httpRequest,
        HttpServletResponse response
    ) {
        AuthResult result = authService.login(request, resolveClientIp(httpRequest));
        cookies.setAuthCookies(response, result.accessToken(), result.refreshToken());
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
        cookies.setAuthCookies(response, result.accessToken(), result.refreshToken());
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
        cookies.clearAuthCookies(response);
    }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal String userId) {
        return authService.me(requireUserId(userId));
    }

    @PatchMapping("/me")
    public MeResponse updateMe(
        @AuthenticationPrincipal String userId,
        @Valid @RequestBody UpdateProfileRequest request
    ) {
        // Parse the principal before calling the service so a malformed
        // principal stays a 401 and never masks a service validation error.
        return authService.updateProfile(requireUserId(userId), request);
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

    // ── helpers ───────────────────────────────────────────────────────────────

    /** Resolves the authenticated user's id, or 401s if the principal is missing/malformed. */
    private UUID requireUserId(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new UnauthorizedException("Authentication required");
        }
        try {
            return UUID.fromString(userId);
        } catch (IllegalArgumentException ex) {
            throw new UnauthorizedException("Authentication required");
        }
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
                .filter(c -> AuthCookieWriter.REFRESH_TOKEN_COOKIE.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElseThrow(() -> new UnauthorizedException("No refresh token provided"));
        }
        throw new UnauthorizedException("No refresh token provided");
    }
}
