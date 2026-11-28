package com.photographplatform.api.auth.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.PasswordResetToken;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.PasswordResetTokenRepository;
import com.photographplatform.api.auth.repository.RefreshTokenRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.common.util.TokenUtils;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.service.EmailService;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import com.photographplatform.api.common.security.RateLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Passwordless recovery for password-based (photographer/admin) accounts.
 *
 * <h2>Threat-model notes</h2>
 * <ul>
 *   <li>Only the SHA-256 hash of the token is stored, so a database leak cannot
 *       be replayed into account takeover. Same design as refresh, verification
 *       and magic-link tokens.</li>
 *   <li>Tokens are single-use and short-lived (1h, vs 24h for email
 *       verification): a reset link is a bearer credential <em>for the account
 *       itself</em>, so a leaked one must decay fast.</li>
 *   <li>Requesting a new link invalidates all prior unused ones, so a phished
 *       earlier link is dead the moment the real user asks for another.</li>
 *   <li>{@link #requestReset} always returns silently, whether or not the
 *       address is on file — otherwise the endpoint is an account-existence
 *       oracle for anyone who can type an email.</li>
 *   <li>Rate-limited per email AND per IP, bounding both targeted mailbox
 *       flooding and bulk enumeration attempts.</li>
 *   <li>A completed reset revokes every refresh token for the user. This is the
 *       point of a reset when the account is already compromised: without it,
 *       the attacker's existing session survives the password change and the
 *       reset accomplishes nothing.</li>
 * </ul>
 *
 * <h2>Why customers are excluded</h2>
 * Customer accounts are passwordless by construction — {@code CustomerAuthService}
 * creates them with a null password hash and they sign in with magic links. A
 * reset that <em>set</em> a password on such an account would silently invent a
 * second, weaker way into it that the auth model never intended. So a reset is
 * only ever issued to a user who already has a password.
 */
@Service
public class PasswordResetService {

    private static final Logger LOG = LoggerFactory.getLogger(PasswordResetService.class);

    private static final Duration TOKEN_TTL = Duration.ofHours(1);
    private static final int MAX_PER_EMAIL_PER_HOUR = 3;
    private static final int MAX_PER_IP_PER_HOUR = 10;
    private static final Duration RATE_WINDOW = Duration.ofHours(1);

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final RateLimiter rateLimiter;
    private final Clock clock;
    private final AuditService auditService;
    private final SessionRevocation sessionRevocation;

    public PasswordResetService(
        UserRepository userRepository,
        PasswordResetTokenRepository tokenRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordEncoder passwordEncoder,
        EmailService emailService,
        RateLimiter rateLimiter,
        Clock clock,
        AuditService auditService,
        SessionRevocation sessionRevocation
    ) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
        this.auditService = auditService;
        this.sessionRevocation = sessionRevocation;
    }

    /**
     * Issues a reset link for {@code email}, if that address belongs to a
     * password-based account.
     *
     * <p>Returns silently in every other case — unknown address, passwordless
     * customer, mail failure. The caller answers 204 unconditionally, so the
     * response cannot be used to learn whether an account exists.
     */
    @Transactional
    public void requestReset(String email, String ipAddress) {
        if (email == null || email.isBlank()) {
            return;
        }
        String normalizedEmail = Normalize.email(email);

        // Rate-limit BEFORE touching the database, so an attacker cannot probe
        // at full speed even for addresses that don't exist.
        enforceRateLimit("pwreset:req:email:" + normalizedEmail, MAX_PER_EMAIL_PER_HOUR);
        if (ipAddress != null && !ipAddress.isBlank()) {
            enforceRateLimit("pwreset:req:ip:" + ipAddress, MAX_PER_IP_PER_HOUR);
        }

        // Staff only — same reasoning as login: no tenant is supplied, so the
        // address has to resolve to one account, and only staff accounts have a
        // password to reset. The passwordless-customer branch below still stands
        // for a staff row that somehow has no hash.
        User user = userRepository.findStaffByEmail(normalizedEmail).orElse(null);
        if (user == null) {
            LOG.info("Password reset requested for unknown address");
            return;
        }
        if (user.getPasswordHash() == null) {
            // A passwordless (magic-link) customer. Issuing a reset here would
            // mint a password for an account designed never to have one.
            LOG.info("Password reset requested for passwordless user {} — ignoring", user.getId());
            return;
        }

        tokenRepository.invalidateAllForUser(user.getId(), OffsetDateTime.now(clock));

        String rawToken = TokenUtils.generateSecureToken();
        tokenRepository.save(new PasswordResetToken(
            user.getId(),
            TokenUtils.sha256(rawToken),
            OffsetDateTime.now(clock).plus(TOKEN_TTL)
        ));
        sendResetEmail(user, rawToken);

        tryAudit("PASSWORD_RESET_REQUESTED", user, ipAddress);
    }

    /**
     * Consumes a reset token and sets the new password.
     *
     * <p>Every failure mode — unknown token, expired, already used, missing user
     * — surfaces the same message, so the endpoint never becomes a token-status
     * oracle.
     */
    @Transactional
    public void reset(String rawToken, String newPassword, String ipAddress) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new UnauthorizedException("Invalid or expired reset link");
        }

        PasswordResetToken token = tokenRepository.findByTokenHash(TokenUtils.sha256(rawToken))
            .orElseThrow(() -> new UnauthorizedException("Invalid or expired reset link"));

        if (token.isUsed() || token.isExpired()) {
            throw new UnauthorizedException("Invalid or expired reset link");
        }

        User user = userRepository.findById(token.getUserId())
            .orElseThrow(() -> new UnauthorizedException("Invalid or expired reset link"));

        // Defence in depth: the request path never issues tokens to passwordless
        // accounts, so reaching here with one means something upstream is wrong.
        if (user.getPasswordHash() == null) {
            throw new UnauthorizedException("Invalid or expired reset link");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));

        // Clicking a link sent to the address proves ownership of it — the same
        // reasoning that lets a magic-link login verify an email.
        if (!user.isEmailVerified()) {
            user.setEmailVerifiedAt(OffsetDateTime.now(clock));
        }
        userRepository.save(user);

        token.markUsed();
        tokenRepository.save(token);
        tokenRepository.invalidateAllForUser(user.getId(), OffsetDateTime.now(clock));

        // The whole point of a reset is usually that someone else may be inside
        // the account. Changing the password while leaving their refresh token
        // alive would change nothing for them.
        refreshTokenRepository.invalidateAllForUser(user.getId());

        // Nor would it, while leaving their ACCESS token alive — and that was
        // the real hole: the refresh token died here but the attacker's access
        // token kept working for up to a day after the victim changed their
        // password, with nothing in the product able to eject them.
        sessionRevocation.revokeAllFor(user.getId());

        tryAudit("PASSWORD_RESET_COMPLETED", user, ipAddress);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void enforceRateLimit(String key, int max) {
        rateLimiter.check(key, max, RATE_WINDOW,
            "Too many reset requests. Please try again later.");
    }

    private void sendResetEmail(User user, String rawToken) {
        // Expires with the token: a link that arrives dead is worse than a
        // late one. No idempotency key — every request is a new token.
        emailService.queue(new OutgoingEmail(
            PasswordResetEmail.TEMPLATE, user.getEmail(), user.getTenantId(),
            new PasswordResetEmail.Params(user.getFullName(), rawToken, user.getLanguage()),
            null, OffsetDateTime.now(clock).plus(TOKEN_TTL)));
    }

    /** Kept as a local shape only because every call here is about a user. */
    private void tryAudit(String action, User user, String ipAddress) {
        auditService.logQuietly(
            action, "USER", user.getId(), user.getTenantId(), user.getId(), ipAddress);
    }

}
