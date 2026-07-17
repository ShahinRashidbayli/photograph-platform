package com.photographplatform.api.auth.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.PasswordResetToken;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.PasswordResetTokenRepository;
import com.photographplatform.api.auth.repository.RefreshTokenRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.exception.TooManyRequestsException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.service.EmailService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
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
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private static final int MAX_PER_EMAIL_PER_HOUR = 3;
    private static final int MAX_PER_IP_PER_HOUR = 10;
    private static final Duration RATE_WINDOW = Duration.ofHours(1);

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final StringRedisTemplate redis;
    private final AuditService auditService;
    private final String webBaseUrl;

    public PasswordResetService(
        UserRepository userRepository,
        PasswordResetTokenRepository tokenRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordEncoder passwordEncoder,
        EmailService emailService,
        StringRedisTemplate redis,
        AuditService auditService,
        @Value("${app.web.base-url:http://localhost:3000}") String webBaseUrl
    ) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.redis = redis;
        this.auditService = auditService;
        this.webBaseUrl = webBaseUrl;
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
        String normalizedEmail = email.trim().toLowerCase();

        // Rate-limit BEFORE touching the database, so an attacker cannot probe
        // at full speed even for addresses that don't exist.
        enforceRateLimit("pwreset:req:email:" + normalizedEmail, MAX_PER_EMAIL_PER_HOUR);
        if (ipAddress != null && !ipAddress.isBlank()) {
            enforceRateLimit("pwreset:req:ip:" + ipAddress, MAX_PER_IP_PER_HOUR);
        }

        User user = userRepository.findByEmail(normalizedEmail).orElse(null);
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

        tokenRepository.invalidateAllForUser(user.getId(), OffsetDateTime.now());

        String rawToken = generateToken();
        tokenRepository.save(new PasswordResetToken(
            user.getId(),
            sha256(rawToken),
            OffsetDateTime.now().plus(TOKEN_TTL)
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

        PasswordResetToken token = tokenRepository.findByTokenHash(sha256(rawToken))
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
            user.setEmailVerifiedAt(OffsetDateTime.now());
        }
        userRepository.save(user);

        token.markUsed();
        tokenRepository.save(token);
        tokenRepository.invalidateAllForUser(user.getId(), OffsetDateTime.now());

        // The whole point of a reset is usually that someone else may be inside
        // the account. Changing the password while leaving their refresh token
        // alive would change nothing for them.
        refreshTokenRepository.invalidateAllForUser(user.getId());

        tryAudit("PASSWORD_RESET_COMPLETED", user, ipAddress);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void enforceRateLimit(String key, int max) {
        Long count = redis.opsForValue().increment(key);
        if (count != null && count == 1) {
            redis.expire(key, RATE_WINDOW);
        }
        if (count != null && count > max) {
            throw new TooManyRequestsException(
                "Too many reset requests. Please try again later.");
        }
    }

    private void sendResetEmail(User user, String rawToken) {
        String link = webBaseUrl.replaceAll("/+$", "") + "/reset-password?token=" + rawToken;
        String greeting = user.getFullName() == null || user.getFullName().isBlank()
            ? "there" : user.getFullName();
        String html = """
            <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; \
            max-width: 520px; margin: 0 auto; padding: 32px;">
              <h2 style="color:#0F172A; margin:0 0 16px 0;">Reset your password</h2>
              <p style="color:#334155; font-size:15px; line-height:1.6;">
                Hi %s, click the button below to choose a new password.
              </p>
              <p style="margin:24px 0;">
                <a href="%s" style="display:inline-block; padding:12px 22px; \
                background:#0F172A; color:#FFFFFF; text-decoration:none; \
                border-radius:8px; font-weight:600;">Choose a new password</a>
              </p>
              <p style="color:#64748B; font-size:13px; line-height:1.6;">
                Or paste this link into your browser:<br/>
                <span style="word-break:break-all;">%s</span>
              </p>
              <p style="color:#94A3B8; font-size:12px; margin-top:32px;">
                This link expires in 1 hour and can only be used once. If you didn't \
                request a password reset, you can safely ignore this email — your \
                password stays unchanged.
              </p>
            </div>
            """.formatted(HtmlEscape.escape(greeting), link, link);
        try {
            emailService.send(new EmailMessage(user.getEmail(), "Reset your Fotolio password", html));
        } catch (RuntimeException ex) {
            // Best-effort, like every other send: the token is already committed,
            // and surfacing the failure here would leak that the account exists.
            LOG.warn("Failed to send password-reset email to {}", user.getEmail(), ex);
        }
    }

    private void tryAudit(String action, User user, String ipAddress) {
        try {
            auditService.log(action, "USER", user.getId(),
                user.getTenantId(), user.getId(), ipAddress);
        } catch (RuntimeException ex) {
            LOG.warn("Audit log failed for {} on {}", action, user.getId(), ex);
        }
    }

    private static String generateToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
