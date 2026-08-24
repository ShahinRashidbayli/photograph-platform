package com.photographplatform.api.auth.controller;

import com.photographplatform.api.common.security.AllowedWhenReadOnly;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.AvatarPresignResponse;
import com.photographplatform.api.auth.dto.AuthResult;
import com.photographplatform.api.auth.dto.ForgotPasswordRequest;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.MeResponse;
import com.photographplatform.api.auth.dto.RefreshRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.auth.dto.ResetPasswordRequest;
import com.photographplatform.api.auth.dto.SubdomainAvailabilityResponse;
import com.photographplatform.api.auth.dto.UpdateProfileRequest;
import com.photographplatform.api.auth.dto.VerifyEmailRequest;
import com.photographplatform.api.auth.service.AuthCookieWriter;
import com.photographplatform.api.auth.service.AuthService;
import com.photographplatform.api.auth.service.AvatarService;
import com.photographplatform.api.auth.service.EmailVerificationService;
import com.photographplatform.api.auth.service.PasswordResetService;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.ClientIp;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Arrays;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
// Session management must survive the read-only lock: a photographer who
// cannot log in cannot see why they are locked out, and cannot reach the
// billing screen that ends it.
@AllowedWhenReadOnly
public class AuthController {

    private final AuthService authService;
    private final EmailVerificationService emailVerificationService;
    private final PasswordResetService passwordResetService;
    private final AuthCookieWriter cookies;
    private final AvatarService avatarService;

    public AuthController(
        AuthService authService,
        EmailVerificationService emailVerificationService,
        PasswordResetService passwordResetService,
        AuthCookieWriter cookies,
        AvatarService avatarService
    ) {
        this.authService = authService;
        this.emailVerificationService = emailVerificationService;
        this.passwordResetService = passwordResetService;
        this.cookies = cookies;
        this.avatarService = avatarService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(
        @Valid @RequestBody RegisterRequest request,
        HttpServletRequest httpRequest,
        HttpServletResponse response
    ) {
        AuthResult result = authService.register(request, ClientIp.from(httpRequest));
        cookies.setAuthCookies(response, result.accessToken(), result.refreshToken());
        return result.response();
    }

    /**
     * Is this subdomain free? Called by the sign-up form as the user types.
     *
     * <p>Unauthenticated by design — the caller is by definition someone who
     * does not have an account yet. See
     * {@link AuthService#checkSubdomainAvailability} for why answering this
     * publicly gives nothing away.
     */
    @GetMapping("/subdomain-available")
    public SubdomainAvailabilityResponse subdomainAvailable(
        @RequestParam String subdomain,
        HttpServletRequest httpRequest
    ) {
        return authService.checkSubdomainAvailability(subdomain, ClientIp.from(httpRequest));
    }

    @PostMapping("/login")
    public AuthResponse login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest httpRequest,
        HttpServletResponse response
    ) {
        AuthResult result = authService.login(request, ClientIp.from(httpRequest));
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

    /**
     * Step 1 of password recovery: email a reset link.
     *
     * <p>Always 204, whether or not the address is on file. Reporting "no such
     * user" would turn this unauthenticated endpoint into an account-existence
     * oracle for anyone who can type an email address — and rate limiting alone
     * wouldn't fix that, it would only slow it down.
     */
    @PostMapping("/password/forgot")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void forgotPassword(
        @Valid @RequestBody ForgotPasswordRequest request,
        HttpServletRequest httpRequest
    ) {
        passwordResetService.requestReset(request.email(), ClientIp.from(httpRequest));
    }

    /**
     * Step 2: consume the token and set the new password. Every failure mode
     * (unknown / expired / already-used token) returns the same 401, so the
     * endpoint can't be used to probe token status.
     *
     * <p>Deliberately does NOT sign the user in. After a reset they land on the
     * login page and enter the new password — which proves the reset did what
     * they meant it to, and keeps a single place where a session is minted.
     */
    @PostMapping("/password/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(
        @Valid @RequestBody ResetPasswordRequest request,
        HttpServletRequest httpRequest
    ) {
        passwordResetService.reset(
            request.token(), request.password(), ClientIp.from(httpRequest));
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
            emailVerificationService.resend(UUID.fromString(userId), ClientIp.from(httpRequest));
        } catch (IllegalArgumentException ex) {
            throw new UnauthorizedException("Authentication required");
        }
    }

    /**
     * Step 1 of profile-photo upload: returns a pre-signed PUT URL so the
     * browser can upload the avatar directly to R2, and a view URL to store
     * in the profile after the upload succeeds.
     * <p>
     * Accepts an optional {@code contentType} query param (default {@code image/jpeg})
     * and a required {@code fileSizeBytes}, which is signed into the upload URL
     * so the PUT is bounded — see {@code R2StorageService#generateUploadUrl}.
     * After uploading, the client should {@code PATCH /api/auth/me} with
     * {@code {"avatarUrl": "<viewUrl>"}}.  The view URL is a pre-signed GET
     * URL that refreshes on the next call, so callers should not cache it.
     */
    @PostMapping("/me/avatar/presign")
    public ResponseEntity<AvatarPresignResponse> presignAvatar(
        @AuthenticationPrincipal String userId,
        @RequestParam(defaultValue = "image/jpeg") String contentType,
        @RequestParam long fileSizeBytes
    ) {
        requireUserId(userId);
        return ResponseEntity.ok(avatarService.presign(contentType, fileSizeBytes));
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
