package com.photographplatform.api.auth;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.PasswordResetToken;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.PasswordResetTokenRepository;
import com.photographplatform.api.auth.repository.RefreshTokenRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.auth.service.PasswordResetService;
import com.photographplatform.api.auth.service.SessionRevocation;
import com.photographplatform.api.common.exception.TooManyRequestsException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.RateLimiter;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.service.EmailService;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The rules a password reset must not get wrong.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordResetServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final String EMAIL = "anna@example.com";
    private static final String NEW_PASSWORD = "brand-new-passw0rd";

    @Mock private UserRepository userRepository;
    @Mock private PasswordResetTokenRepository tokenRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private EmailService emailService;
    @Mock private RateLimiter rateLimiter;
    @Mock private AuditService auditService;
    @Mock private SessionRevocation sessionRevocation;

    /**
     * Fixed, so token TTLs are assertable rather than "roughly an hour from
     * whenever the suite happened to run".
     */
    private static final Clock FIXED_CLOCK =
        Clock.fixed(Instant.parse("2026-03-01T12:00:00Z"), ZoneOffset.UTC);

    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        when(passwordEncoder.encode(anyString())).thenReturn("bcrypt-of-new-password");

        service = new PasswordResetService(
            userRepository, tokenRepository, refreshTokenRepository, passwordEncoder,
            emailService, rateLimiter, FIXED_CLOCK, auditService, sessionRevocation);
    }

    private static User photographer() {
        User user = mock(User.class);
        when(user.getId()).thenReturn(USER_ID);
        when(user.getTenantId()).thenReturn(TENANT_ID);
        when(user.getEmail()).thenReturn(EMAIL);
        when(user.getFullName()).thenReturn("Anna");
        when(user.getPasswordHash()).thenReturn("bcrypt-of-old-password");
        when(user.isEmailVerified()).thenReturn(true);
        return user;
    }

    private static PasswordResetToken liveToken() {
        return new PasswordResetToken(USER_ID, "hash", OffsetDateTime.now().plusMinutes(30));
    }

    // ── request ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("a known password account gets a token and an email")
    void issuesTokenForPasswordAccount() {
        // Built before the when(...) below: photographer() stubs its own mock,
        // and Mockito rejects a stubbing started inside an unfinished one.
        User user = photographer();
        when(userRepository.findStaffByEmail(EMAIL)).thenReturn(Optional.of(user));

        service.requestReset(EMAIL, "1.2.3.4");

        verify(tokenRepository).save(any(PasswordResetToken.class));
        verify(emailService).queue(any(OutgoingEmail.class));
        // Any earlier link must die the moment a fresh one is asked for.
        verify(tokenRepository).invalidateAllForUser(eq(USER_ID), any(OffsetDateTime.class));
    }

    /**
     * The rule that matters most here. Customers are passwordless by
     * construction — {@code CustomerAuthService} creates them with a null hash
     * and they sign in by magic link. Handing one a reset link would quietly
     * invent a password-shaped way into an account that was never meant to have
     * one.
     */
    @Test
    @DisplayName("a passwordless magic-link customer is never issued a reset link")
    void refusesToMintAPasswordForACustomer() {
        User customer = mock(User.class);
        when(customer.getPasswordHash()).thenReturn(null);
        when(userRepository.findStaffByEmail(EMAIL)).thenReturn(Optional.of(customer));

        service.requestReset(EMAIL, "1.2.3.4");

        verify(tokenRepository, never()).save(any());
        verify(emailService, never()).queue(any());
    }

    /** Silence is the contract: the caller answers 204 either way. */
    @Test
    @DisplayName("an unknown address is not an account-existence oracle")
    void unknownEmailIsSilent() {
        when(userRepository.findStaffByEmail(anyString())).thenReturn(Optional.empty());

        assertThatCode(() -> service.requestReset("nobody@example.com", "1.2.3.4"))
            .doesNotThrowAnyException();

        verify(tokenRepository, never()).save(any());
        verify(emailService, never()).queue(any());
    }

    @Test
    @DisplayName("request is rate-limited")
    void rateLimitIsEnforced() {
        // The counting itself now lives in RateLimiter and is tested there.
        // What this asserts is the thing only this service can get wrong:
        // that it consults the limiter, and does so before touching the
        // database.
        doThrow(new TooManyRequestsException("Too many reset requests."))
            .when(rateLimiter).check(anyString(), anyInt(), any(), anyString());

        assertThatThrownBy(() -> service.requestReset(EMAIL, "1.2.3.4"))
            .isInstanceOf(TooManyRequestsException.class);

        // Rejected before any database work — an attacker can't probe at speed.
        verify(userRepository, never()).findStaffByEmail(anyString());
    }

    // ── reset ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("a valid token sets the new password and burns the token")
    void validTokenResetsPassword() {
        User user = photographer();
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(liveToken()));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        service.reset("raw-token", NEW_PASSWORD, "1.2.3.4");

        verify(passwordEncoder).encode(NEW_PASSWORD);
        verify(user).setPasswordHash("bcrypt-of-new-password");
        verify(userRepository).save(user);
        verify(tokenRepository).save(any(PasswordResetToken.class));
    }

    /**
     * A reset usually happens *because* somebody else may be in the account.
     * Changing the password while leaving their refresh token alive would
     * accomplish exactly nothing for them.
     */
    @Test
    @DisplayName("a completed reset revokes every existing session")
    void resetRevokesRefreshTokens() {
        User user = photographer();
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(liveToken()));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        service.reset("raw-token", NEW_PASSWORD, "1.2.3.4");

        verify(refreshTokenRepository).invalidateAllForUser(USER_ID);
    }

    /** Clicking a link sent to the address proves the address is theirs. */
    @Test
    @DisplayName("resetting also verifies an unverified email")
    void resetVerifiesEmail() {
        User user = photographer();
        when(user.isEmailVerified()).thenReturn(false);
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(liveToken()));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        service.reset("raw-token", NEW_PASSWORD, "1.2.3.4");

        verify(user).setEmailVerifiedAt(any(OffsetDateTime.class));
    }

    @Test
    @DisplayName("an already-used token is refused")
    void usedTokenIsRefused() {
        PasswordResetToken used = liveToken();
        used.markUsed();
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(used));

        assertThatThrownBy(() -> service.reset("raw-token", NEW_PASSWORD, "1.2.3.4"))
            .isInstanceOf(UnauthorizedException.class);

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("an expired token is refused")
    void expiredTokenIsRefused() {
        PasswordResetToken expired = new PasswordResetToken(
            USER_ID, "hash", OffsetDateTime.now().minusMinutes(1));
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> service.reset("raw-token", NEW_PASSWORD, "1.2.3.4"))
            .isInstanceOf(UnauthorizedException.class);

        verify(userRepository, never()).save(any());
    }

    /** Same message as every other failure — no token-status oracle. */
    @Test
    @DisplayName("an unknown token is refused")
    void unknownTokenIsRefused() {
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.reset("raw-token", NEW_PASSWORD, "1.2.3.4"))
            .isInstanceOf(UnauthorizedException.class)
            .hasMessageContaining("Invalid or expired");
    }

    /**
     * Defence in depth: even if a token somehow existed for a passwordless
     * account, consuming it must not mint a password.
     */
    @Test
    @DisplayName("a token pointing at a passwordless account is refused")
    void tokenForPasswordlessAccountIsRefused() {
        User customer = mock(User.class);
        when(customer.getPasswordHash()).thenReturn(null);
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(liveToken()));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(customer));

        assertThatThrownBy(() -> service.reset("raw-token", NEW_PASSWORD, "1.2.3.4"))
            .isInstanceOf(UnauthorizedException.class);

        verify(customer, never()).setPasswordHash(anyString());
        verify(refreshTokenRepository, never()).invalidateAllForUser(any());
    }
}
