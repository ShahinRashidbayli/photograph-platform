package com.photographplatform.api.auth.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.MagicLinkToken;
import com.photographplatform.api.auth.domain.RefreshToken;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.AuthResult;
import com.photographplatform.api.auth.repository.MagicLinkTokenRepository;
import com.photographplatform.api.auth.repository.RefreshTokenRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.exception.TooManyRequestsException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.service.EmailService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.common.util.TokenUtils;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Passwordless (magic-link) authentication for customers.
 *
 * Why a separate service from {@link AuthService}?
 *  - Photographer auth is password-based and creates a tenant on register;
 *    customer auth is passwordless and joins an *existing* photographer tenant.
 *    Mixing the two collapses two unrelated lifecycles into one method.
 *  - The "customer email may exist under multiple tenants" rule (a single
 *    person can contact several photographers) makes the global
 *    {@code existsByEmail} check inappropriate here. We scope by
 *    {@code (tenant_id, email)} instead.
 *
 * Threat-model notes:
 *  - Plaintext token is shown only in the email link; only its SHA-256 hash
 *    is stored, mirroring refresh- and verification-token designs.
 *  - Tokens are single-use and short-lived (15 minutes — long enough for an
 *    email round-trip, short enough that a leaked link decays quickly).
 *  - Re-issuing a token invalidates all prior unused tokens for the user, so
 *    a phished earlier link cannot be used after the user clicks Resend.
 *  - The /request endpoint always responds 204 regardless of whether the
 *    address is on file, so it cannot be used as an account-existence oracle
 *    for a given photographer.
 *  - Rate-limited per (tenant, email) AND per IP to bound both targeted
 *    mailbox flooding and bulk abuse.
 */
@Service
public class CustomerAuthService {

    private static final Logger LOG = LoggerFactory.getLogger(CustomerAuthService.class);

    private static final Duration TOKEN_TTL = Duration.ofMinutes(15);
    private static final int REQUEST_MAX_PER_EMAIL_PER_HOUR = 5;
    private static final int REQUEST_MAX_PER_IP_PER_HOUR = 20;
    private static final Duration REQUEST_WINDOW = Duration.ofHours(1);

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final MagicLinkTokenRepository tokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final StringRedisTemplate redis;
    private final AuditService auditService;
    private final AvatarUrlResolver avatarUrlResolver;
    private final String webBaseUrl;
    private final long refreshTokenExpiryMs;

    public CustomerAuthService(
        TenantRepository tenantRepository,
        UserRepository userRepository,
        MagicLinkTokenRepository tokenRepository,
        RefreshTokenRepository refreshTokenRepository,
        JwtService jwtService,
        EmailService emailService,
        StringRedisTemplate redis,
        AuditService auditService,
        AvatarUrlResolver avatarUrlResolver,
        @Value("${app.web.base-url:http://localhost:3000}") String webBaseUrl,
        @Value("${app.jwt.refresh-token-expiry-ms}") long refreshTokenExpiryMs
    ) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.redis = redis;
        this.auditService = auditService;
        this.avatarUrlResolver = avatarUrlResolver;
        this.webBaseUrl = webBaseUrl;
        this.refreshTokenExpiryMs = refreshTokenExpiryMs;
    }

    /**
     * Issues a magic-link email for a customer of the given photographer.
     * Creates the customer account on first request (just-in-time signup).
     *
     * Always returns silently — never reveals whether the email existed,
     * to avoid an account-existence oracle. Failures are logged.
     */
    @Transactional
    public void requestMagicLink(String subdomain, String email, String fullName, String ipAddress) {
        if (subdomain == null || subdomain.isBlank() || email == null || email.isBlank()) {
            return;
        }
        String normalizedSubdomain = Normalize.lower(subdomain);
        String normalizedEmail = Normalize.email(email);

        // Rate-limit BEFORE doing any DB work so an unauthenticated attacker
        // cannot probe the system at full speed.
        enforceRateLimit("magic:req:email:" + normalizedSubdomain + ":" + normalizedEmail,
            REQUEST_MAX_PER_EMAIL_PER_HOUR);
        if (ipAddress != null && !ipAddress.isBlank()) {
            enforceRateLimit("magic:req:ip:" + ipAddress, REQUEST_MAX_PER_IP_PER_HOUR);
        }

        Tenant tenant = tenantRepository.findBySubdomain(normalizedSubdomain).orElse(null);
        if (tenant == null) {
            // Don't leak which subdomains are valid via timing — log and return.
            LOG.info("Magic link requested for unknown subdomain '{}'", normalizedSubdomain);
            return;
        }

        User user = userRepository.findByTenantIdAndEmail(tenant.getId(), normalizedEmail)
            .orElseGet(() -> createCustomer(tenant, normalizedEmail, fullName));

        // Customers are passwordless: a row that somehow has a password (e.g.
        // a photographer trying the customer flow on their own subdomain)
        // should not be eligible for magic-link login.
        if (!"CUSTOMER".equals(user.getRole())) {
            LOG.warn("Magic link requested for non-customer user {} on subdomain {}",
                user.getId(), normalizedSubdomain);
            return;
        }

        // Invalidate any older unused tokens before issuing a fresh one.
        tokenRepository.invalidateAllForUser(user.getId(), OffsetDateTime.now());

        String rawToken = TokenUtils.generateSecureToken();
        tokenRepository.save(new MagicLinkToken(
            user.getId(),
            TokenUtils.sha256(rawToken),
            OffsetDateTime.now().plus(TOKEN_TTL)
        ));
        sendMagicLinkEmail(user, rawToken);

        tryAudit("CUSTOMER_MAGIC_LINK_REQUESTED", "USER", user.getId(),
            tenant.getId(), user.getId(), ipAddress);
    }

    /**
     * Verifies a magic-link token and issues an access + refresh token pair.
     * Marks the token used and the user's email as verified (clicking the link
     * proves email ownership, just like {@link EmailVerificationService}).
     */
    @Transactional
    public AuthResult verifyMagicLink(String rawToken, String ipAddress) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new UnauthorizedException("Invalid or expired login link");
        }

        MagicLinkToken token = tokenRepository.findByTokenHash(TokenUtils.sha256(rawToken))
            .orElseThrow(() -> new UnauthorizedException("Invalid or expired login link"));

        if (token.isUsed() || token.isExpired()) {
            throw new UnauthorizedException("Invalid or expired login link");
        }

        User user = userRepository.findById(token.getUserId())
            .orElseThrow(() -> new UnauthorizedException("Invalid or expired login link"));

        // Defence in depth: the token table holds only customer tokens by
        // construction, but verify the role anyway so a future bug that issues
        // a magic link to a photographer cannot bypass password auth.
        if (!"CUSTOMER".equals(user.getRole())) {
            throw new UnauthorizedException("Invalid or expired login link");
        }

        Tenant tenant = tenantRepository.findById(user.getTenantId())
            .orElseThrow(() -> new UnauthorizedException("Invalid or expired login link"));

        token.markUsed();
        tokenRepository.save(token);
        // Belt-and-braces: kill any other outstanding tokens too.
        tokenRepository.invalidateAllForUser(user.getId(), OffsetDateTime.now());

        if (!user.isEmailVerified()) {
            user.setEmailVerifiedAt(OffsetDateTime.now());
        }
        user.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(user);

        tryAudit("CUSTOMER_LOGIN", "USER", user.getId(),
            tenant.getId(), user.getId(), ipAddress);

        return buildAuthResult(user, tenant);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private User createCustomer(Tenant tenant, String email, String fullName) {
        User user = new User(
            tenant.getId(),
            email,
            null, // no password — magic link only
            fullName != null && !fullName.isBlank() ? fullName.trim() : null
        );
        user.setRole("CUSTOMER");
        return userRepository.save(user);
    }

    private AuthResult buildAuthResult(User user, Tenant tenant) {
        String accessToken = jwtService.generateToken(user.getId(), tenant.getId(), user.getRole());
        String rawRefresh = TokenUtils.generateSecureToken();
        refreshTokenRepository.save(new RefreshToken(
            user.getId(),
            tenant.getId(),
            TokenUtils.sha256(rawRefresh),
            OffsetDateTime.now().plus(Duration.ofMillis(refreshTokenExpiryMs))
        ));
        AuthResponse response = new AuthResponse(
            user.getId(),
            user.getEmail(),
            user.getFullName(),
            user.getRole(),
            user.isEmailVerified(),
            new AuthResponse.TenantInfo(tenant.getSubdomain(), tenant.getPlan()),
            avatarUrlResolver.resolve(user.getAvatarUrl())
        );
        return new AuthResult(response, accessToken, rawRefresh);
    }

    private void sendMagicLinkEmail(User user, String rawToken) {
        String link = webBaseUrl.replaceAll("/+$", "")
            + "/customer/auth/verify?token=" + rawToken;
        String greetingName = user.getFullName() != null && !user.getFullName().isBlank()
            ? user.getFullName() : "there";
        String html = EmailTemplate.document(
            "Your Fotolio sign-in link — expires in 15 minutes.",
            EmailTemplate.heading("Sign in to your booking")
                + EmailTemplate.paragraph("Hi " + HtmlEscape.escape(greetingName)
                    + ", tap the button below to sign in. No password needed.")
                + EmailTemplate.button("Sign in", link)
                + EmailTemplate.note("Or paste this link into your browser:<br>"
                    + "<span style=\"word-break:break-all;\">" + HtmlEscape.escape(link) + "</span>")
                + EmailTemplate.note("This link expires in 15 minutes and can only be used once. "
                    + "If you didn't request it, you can safely ignore this email."));
        try {
            emailService.send(new EmailMessage(
                user.getEmail(), "Your sign-in link", html));
        } catch (RuntimeException ex) {
            LOG.warn("Failed to send magic-link email to {}", user.getEmail(), ex);
        }
    }

    private void enforceRateLimit(String key, int max) {
        Long count = redis.opsForValue().increment(key);
        if (count != null && count == 1) {
            redis.expire(key, REQUEST_WINDOW);
        }
        if (count != null && count > max) {
            throw new TooManyRequestsException(
                "Too many login attempts. Please try again later.");
        }
    }

    private void tryAudit(String action, String entityType, UUID entityId,
                          UUID tenantId, UUID actorId, String ipAddress) {
        try {
            auditService.log(action, entityType, entityId, tenantId, actorId, ipAddress);
        } catch (RuntimeException ex) {
            LOG.warn("Audit log failed for {} on {}", action, entityId, ex);
        }
    }

}
