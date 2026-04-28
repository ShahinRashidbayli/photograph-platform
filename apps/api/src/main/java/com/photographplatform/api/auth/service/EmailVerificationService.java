package com.photographplatform.api.auth.service;

import com.photographplatform.api.auth.domain.EmailVerificationToken;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.EmailVerificationTokenRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.TooManyRequestsException;
import com.photographplatform.api.common.exception.UnauthorizedException;
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
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issues and consumes one-time email verification tokens.
 *
 * Threat-model notes:
 * - Plaintext token is shown only in the email link; only its SHA-256 hash is
 *   stored, mirroring the refresh-token design.
 * - Tokens are single-use and time-bounded (24h).
 * - Re-issuing a token invalidates all prior unused tokens for the user, so a
 *   leaked link from an earlier email cannot be replayed after the user
 *   requests a new one.
 * - Resend is rate-limited per user (3 / hour) AND per IP (10 / hour) to
 *   prevent both per-victim mailbox flooding and bulk abuse.
 */
@Service
public class EmailVerificationService {

    private static final Logger LOG = LoggerFactory.getLogger(EmailVerificationService.class);

    private static final Duration TOKEN_TTL = Duration.ofHours(24);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private static final int RESEND_MAX_PER_USER_PER_HOUR = 3;
    private static final int RESEND_MAX_PER_IP_PER_HOUR = 10;
    private static final Duration RESEND_WINDOW = Duration.ofHours(1);

    private final EmailVerificationTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final StringRedisTemplate redis;
    private final String fromEmail;
    private final String webBaseUrl;

    public EmailVerificationService(
        EmailVerificationTokenRepository tokenRepository,
        UserRepository userRepository,
        EmailService emailService,
        StringRedisTemplate redis,
        @Value("${resend.from-email:noreply@fotoplatform.local}") String fromEmail,
        @Value("${app.web.base-url:http://localhost:3000}") String webBaseUrl
    ) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.redis = redis;
        this.fromEmail = fromEmail;
        this.webBaseUrl = webBaseUrl;
    }

    /**
     * Generates a token, stores its hash, and sends the verification email.
     * Best-effort: a failure to send the email must NOT roll back the
     * surrounding transaction (e.g. registration), so this method swallows
     * email-send exceptions but propagates persistence failures.
     */
    @Transactional
    public void issueAndSend(User user) {
        if (user.isEmailVerified()) {
            return;
        }
        String rawToken = generateToken();
        tokenRepository.save(new EmailVerificationToken(
            user.getId(),
            sha256(rawToken),
            OffsetDateTime.now().plus(TOKEN_TTL)
        ));
        sendVerificationEmail(user, rawToken);
    }

    /**
     * Consumes a token. On success, marks the user as verified and the token
     * as used. Throws {@link UnauthorizedException} on invalid / expired /
     * already-used tokens (uniform error to avoid token-status oracle).
     */
    @Transactional
    public void verify(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new UnauthorizedException("Invalid or expired verification link");
        }
        EmailVerificationToken token = tokenRepository.findByTokenHash(sha256(rawToken))
            .orElseThrow(() -> new UnauthorizedException("Invalid or expired verification link"));

        if (token.isUsed() || token.isExpired()) {
            throw new UnauthorizedException("Invalid or expired verification link");
        }

        User user = userRepository.findById(token.getUserId())
            .orElseThrow(() -> new UnauthorizedException("Invalid or expired verification link"));

        if (user.isEmailVerified()) {
            // Idempotent — same token re-clicked after success is a no-op.
            token.markUsed();
            tokenRepository.save(token);
            return;
        }

        user.setEmailVerifiedAt(OffsetDateTime.now());
        userRepository.save(user);

        token.markUsed();
        tokenRepository.save(token);
        // Invalidate any other outstanding tokens for the same user.
        tokenRepository.invalidateAllForUser(user.getId(), OffsetDateTime.now());
    }

    /**
     * Re-issues a verification token for the currently authenticated user.
     * Rate-limited per user and per IP. No-op (returns silently) if the
     * account is already verified, so the response never reveals state.
     */
    @Transactional
    public void resend(UUID userId, String ipAddress) {
        if (userId == null) {
            throw new UnauthorizedException("Authentication required");
        }
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new UnauthorizedException("User not found"));
        if (user.isEmailVerified()) {
            throw new ConflictException("Email already verified");
        }
        enforceResendRateLimit("verify:resend:user:" + userId, RESEND_MAX_PER_USER_PER_HOUR);
        if (ipAddress != null && !ipAddress.isBlank()) {
            enforceResendRateLimit("verify:resend:ip:" + ipAddress, RESEND_MAX_PER_IP_PER_HOUR);
        }

        // Invalidate old tokens before issuing a fresh one — prevents an
        // attacker who phished an earlier link from using it after the user
        // notices and requests a new email.
        tokenRepository.invalidateAllForUser(userId, OffsetDateTime.now());
        issueAndSend(user);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void enforceResendRateLimit(String key, int max) {
        Long count = redis.opsForValue().increment(key);
        if (count != null && count == 1) {
            redis.expire(key, RESEND_WINDOW);
        }
        if (count != null && count > max) {
            throw new TooManyRequestsException(
                "Too many verification emails requested. Please try again later.");
        }
    }

    private void sendVerificationEmail(User user, String rawToken) {
        String link = webBaseUrl.replaceAll("/+$", "")
            + "/verify-email?token=" + rawToken;
        String html = """
            <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; \
            max-width: 520px; margin: 0 auto; padding: 32px;">
              <h2 style="color:#0F172A; margin:0 0 16px 0;">Confirm your email</h2>
              <p style="color:#334155; font-size:15px; line-height:1.6;">
                Hi %s, please confirm this email address belongs to you so we can \
                deliver booking notifications, lead alerts and password resets.
              </p>
              <p style="margin:24px 0;">
                <a href="%s" style="display:inline-block; padding:12px 22px; \
                background:#0F172A; color:#FFFFFF; text-decoration:none; \
                border-radius:8px; font-weight:600;">Confirm email</a>
              </p>
              <p style="color:#64748B; font-size:13px; line-height:1.6;">
                Or paste this link into your browser:<br/>
                <span style="word-break:break-all;">%s</span>
              </p>
              <p style="color:#94A3B8; font-size:12px; margin-top:32px;">
                This link expires in 24 hours. If you didn't create an account, \
                you can safely ignore this email.
              </p>
            </div>
            """.formatted(escapeHtml(user.getFullName()), link, link);
        try {
            emailService.send(new EmailMessage(
                user.getEmail(), fromEmail, "Confirm your Fotolio email", html));
        } catch (RuntimeException ex) {
            // Email delivery is best-effort — log loudly but never fail the caller.
            LOG.warn("Failed to send verification email to {}", user.getEmail(), ex);
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

    private static String escapeHtml(String input) {
        if (input == null) {
            return "";
        }
        return input
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }
}
