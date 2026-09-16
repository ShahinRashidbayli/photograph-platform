package com.photographplatform.api.auth.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.LoginCode;
import com.photographplatform.api.auth.domain.RefreshToken;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.AuthResult;
import com.photographplatform.api.auth.repository.LoginCodeRepository;
import com.photographplatform.api.auth.repository.RefreshTokenRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.exception.TooManyRequestsException;
import com.photographplatform.api.common.security.RateLimiter;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.service.EmailService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.common.util.TokenUtils;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Passwordless authentication for customers, by emailed six-digit code.
 *
 * <p><b>Why a code and not a link.</b> Customers arrive from a photographer's
 * Instagram bio link, so the page opens inside Instagram's in-app browser. A
 * magic link forces them out to their mail app and back through a *different*
 * browser: the session lands where the link was opened, the customer is left
 * looking at a stale Instagram tab, and a large share simply never return. A
 * code is read from the mail app and typed back into the tab they are already
 * in, so the funnel is never left. That is the whole reason for this design —
 * the link flow worked technically and still lost sign-ups.
 *
 * <p>Why a separate service from {@link AuthService}?
 * <ul>
 *  <li>Photographer auth is password-based and creates a tenant on register;
 *      customer auth is passwordless and joins an *existing* photographer
 *      tenant. Mixing the two collapses unrelated lifecycles into one method.</li>
 *  <li>The "customer email may exist under multiple tenants" rule (one person
 *      can contact several photographers) makes a global {@code existsByEmail}
 *      check wrong here. We scope by {@code (tenant_id, email)} instead.</li>
 * </ul>
 *
 * <p>Threat model. A six-digit code is a much smaller secret than the 256-bit
 * token it replaces, so the guessing budget is closed off from three sides:
 * <ul>
 *  <li>Verification requires the {@code (subdomain, email)} pair as well as the
 *      code, so an attacker must target a mailbox they already know rather than
 *      sweep codes globally.</li>
 *  <li>{@link #MAX_VERIFY_ATTEMPTS} wrong guesses burn the code — 5 tries out of
 *      a million, then it is dead and a new email is required.</li>
 *  <li>The code lives {@link #CODE_TTL}; issuing a new one invalidates every
 *      earlier code for that user, so Resend cannot widen the window.</li>
 * </ul>
 * Only {@code sha256(userId + ":" + code)} is stored; see
 * {@code V32__login_code_attempts.sql} for why the salt matters and what it
 * does not buy.
 *
 * <p>The /request endpoint always responds 204 whether or not the address is on
 * file, so it cannot be used as an account-existence oracle for a photographer,
 * and is rate-limited per (tenant, email) and per IP to bound both targeted
 * mailbox flooding and bulk abuse.
 */
@Service
public class CustomerAuthService {

    private static final Logger LOG = LoggerFactory.getLogger(CustomerAuthService.class);

    /**
     * Shorter than the old link's 15 minutes: the customer has the mail app open
     * next to the form, so the round-trip is seconds, and a smaller window is
     * the cheapest brake on guessing.
     */
    private static final Duration CODE_TTL = Duration.ofMinutes(10);

    /**
     * Wrong guesses before the code is destroyed. Five leaves room for a genuine
     * typo or a stale code from a previous email while keeping the attacker's
     * odds at 5-in-10^6 per issued code.
     */
    private static final int MAX_VERIFY_ATTEMPTS = 5;

    private static final int CODE_DIGITS = 6;
    /** Derived, so the digit count and the value range cannot drift apart. */
    private static final int CODE_BOUND = (int) Math.pow(10, CODE_DIGITS);

    private static final int REQUEST_MAX_PER_EMAIL_PER_HOUR = 5;
    private static final int REQUEST_MAX_PER_IP_PER_HOUR = 20;
    private static final int VERIFY_MAX_PER_IP_PER_HOUR = 30;
    private static final Duration REQUEST_WINDOW = Duration.ofHours(1);

    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * The single rejection message. Every failure path returns this exact text —
     * "no code on file", "expired", "wrong digits" and "already used" are
     * indistinguishable to the caller, so the endpoint cannot be used to learn
     * which addresses have a login in flight.
     */
    private static final String INVALID_CODE = "That code isn't valid. Request a new one.";

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final LoginCodeRepository tokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final RateLimiter rateLimiter;
    private final Clock clock;
    private final AuditService auditService;
    private final AvatarUrlResolver avatarUrlResolver;
    private final long refreshTokenExpiryMs;

    public CustomerAuthService(
        TenantRepository tenantRepository,
        UserRepository userRepository,
        LoginCodeRepository tokenRepository,
        RefreshTokenRepository refreshTokenRepository,
        JwtService jwtService,
        EmailService emailService,
        RateLimiter rateLimiter,
        Clock clock,
        AuditService auditService,
        AvatarUrlResolver avatarUrlResolver,
        @Value("${app.jwt.refresh-token-expiry-ms}") long refreshTokenExpiryMs
    ) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
        this.auditService = auditService;
        this.avatarUrlResolver = avatarUrlResolver;
        this.refreshTokenExpiryMs = refreshTokenExpiryMs;
    }

    /**
     * Emails a fresh login code to a customer of the given photographer.
     * Creates the customer account on first request (just-in-time signup).
     *
     * <p>Always returns silently — never reveals whether the email existed, to
     * avoid an account-existence oracle. Failures are logged.
     */
    @Transactional
    public void requestLoginCode(String subdomain, String email, String fullName, String ipAddress) {
        if (subdomain == null || subdomain.isBlank() || email == null || email.isBlank()) {
            return;
        }
        String normalizedSubdomain = Normalize.lower(subdomain);
        String normalizedEmail = Normalize.email(email);

        // Rate-limit BEFORE doing any DB work so an unauthenticated attacker
        // cannot probe the system at full speed.
        enforceRateLimit("login:req:email:" + normalizedSubdomain + ":" + normalizedEmail,
            REQUEST_MAX_PER_EMAIL_PER_HOUR);
        if (ipAddress != null && !ipAddress.isBlank()) {
            enforceRateLimit("login:req:ip:" + ipAddress, REQUEST_MAX_PER_IP_PER_HOUR);
        }

        Tenant tenant = tenantRepository.findBySubdomain(normalizedSubdomain).orElse(null);
        if (tenant == null) {
            // Don't leak which subdomains are valid via timing — log and return.
            LOG.info("Login code requested for unknown subdomain '{}'", normalizedSubdomain);
            return;
        }

        User user = userRepository.findByTenantIdAndEmail(tenant.getId(), normalizedEmail)
            .orElseGet(() -> createCustomer(tenant, normalizedEmail, fullName));

        // Customers are passwordless: a row that somehow has a password (e.g.
        // a photographer trying the customer flow on their own subdomain)
        // should not be eligible for code login.
        if (!"CUSTOMER".equals(user.getRole())) {
            LOG.warn("Login code requested for non-customer user {} on subdomain {}",
                user.getId(), normalizedSubdomain);
            return;
        }

        // The ceiling that survives a Redis outage.
        //
        // Every limit above this line is Redis-backed, and RateLimiter fails
        // open on purpose — a Redis outage should degrade the product, not take
        // login down with it. The cost is that the same outage lifts the
        // per-email ceiling, leaving only the five-guesses-per-code cap, which
        // an attacker escapes by asking for another code. Counted here from the
        // codes already issued, because issuing one writes a row anyway: the
        // database cannot be unavailable while this flow still works.
        //
        // After the user lookup, not before, because it is keyed on the user.
        // The Redis check above still runs first and still does the cheap work
        // of turning away a flood before any query.
        long issuedInWindow = tokenRepository.countByUserIdAndCreatedAtAfter(
            user.getId(), OffsetDateTime.now(clock).minus(REQUEST_WINDOW));
        if (issuedInWindow >= REQUEST_MAX_PER_EMAIL_PER_HOUR) {
            throw new TooManyRequestsException(
                "Too many login attempts. Please try again later.", REQUEST_WINDOW);
        }

        issueAndSendCode(user);

        auditService.logQuietly("CUSTOMER_LOGIN_CODE_REQUESTED", "USER", user.getId(),
            tenant.getId(), user.getId(), ipAddress);
    }

    /**
     * Verifies an emailed login code and issues an access + refresh token pair.
     * Marks the code used and the user's email as verified — receiving the code
     * proves mailbox ownership, exactly as clicking a link did.
     *
     * <p>The {@code (subdomain, email)} pair is required alongside the code so
     * the lookup is anchored to one mailbox: without it a six-digit secret could
     * be sprayed across every outstanding code in the system, where a few
     * thousand guesses would eventually hit *somebody's*.
     *
     * <p>Every rejection returns the same message. Distinguishing "no such code"
     * from "wrong code" would confirm which addresses have a login in flight.
     *
     * <p><b>{@code noRollbackFor} is load-bearing, not a tidy-up.</b> The failed
     * guess is recorded by incrementing {@code attempts} and then throwing. Under
     * the default rollback rules that throw discards the increment along with
     * everything else in the transaction, so the counter would never leave zero
     * and {@link #MAX_VERIFY_ATTEMPTS} — the only thing standing between a
     * six-digit secret and an offline-speed guessing attack — would never fire.
     * The write must outlive the rejection it describes. No other failure path
     * here writes anything, so committing on rejection costs nothing else.
     */
    @Transactional(noRollbackFor = UnauthorizedException.class)
    public AuthResult verifyLoginCode(String subdomain, String email, String code, String ipAddress) {
        if (ipAddress != null && !ipAddress.isBlank()) {
            enforceRateLimit("login:vrf:ip:" + ipAddress, VERIFY_MAX_PER_IP_PER_HOUR);
        }
        if (subdomain == null || subdomain.isBlank()
            || email == null || email.isBlank()
            || code == null || code.isBlank()) {
            throw new UnauthorizedException(INVALID_CODE);
        }

        Tenant tenant = tenantRepository.findBySubdomain(subdomain.trim().toLowerCase())
            .orElseThrow(() -> new UnauthorizedException(INVALID_CODE));

        User user = userRepository
            .findByTenantIdAndEmail(tenant.getId(), email.trim().toLowerCase())
            .orElseThrow(() -> new UnauthorizedException(INVALID_CODE));

        // Defence in depth: this table holds only customer codes by construction,
        // but verify the role anyway so a future bug that issues a code to a
        // photographer cannot bypass password auth.
        if (!"CUSTOMER".equals(user.getRole())) {
            throw new UnauthorizedException(INVALID_CODE);
        }

        LoginCode token = tokenRepository
            .findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(user.getId())
            .orElseThrow(() -> new UnauthorizedException(INVALID_CODE));

        // The query already filters used rows; re-check anyway so the "single
        // use" rule is enforced here rather than resting entirely on a derived
        // query name that a rename could silently weaken.
        if (token.isUsed() || token.isExpired()) {
            throw new UnauthorizedException(INVALID_CODE);
        }

        // Constant-time, like the CSRF check in SecurityConfig. The attacker
        // supplies `code` and therefore the hash being compared, so a
        // short-circuiting equals() is measurable in principle. The attempt
        // cap makes it impractical here — but the cap is the reason this is
        // safe, not the comparison, and the two should not have to be
        // reasoned about together.
        if (!MessageDigest.isEqual(
            token.getTokenHash().getBytes(StandardCharsets.UTF_8),
            hashLoginCode(user.getId(), code.trim()).getBytes(StandardCharsets.UTF_8))) {
            token.recordFailedAttempt();
            // Burn the code once the budget is spent, so an attacker gets five
            // guesses per *email sent* rather than five per minute forever.
            if (token.getAttempts() >= MAX_VERIFY_ATTEMPTS) {
                token.markUsed();
                LOG.warn("Login code for user {} destroyed after {} failed attempts",
                    user.getId(), token.getAttempts());
            }
            tokenRepository.save(token);
            throw new UnauthorizedException(INVALID_CODE);
        }

        token.markUsed();
        tokenRepository.save(token);
        // Belt-and-braces: kill any other outstanding codes too.
        tokenRepository.invalidateAllForUser(user.getId(), OffsetDateTime.now(clock));

        if (!user.isEmailVerified()) {
            user.setEmailVerifiedAt(OffsetDateTime.now(clock));
        }
        user.setLastLoginAt(OffsetDateTime.now(clock));
        userRepository.save(user);

        auditService.logQuietly("CUSTOMER_LOGIN", "USER", user.getId(),
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
            OffsetDateTime.now(clock).plus(Duration.ofMillis(refreshTokenExpiryMs))
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

    /**
     * Invalidates any code still outstanding for the user, mints a new one and
     * emails it. Invalidating first means Resend narrows the attack surface
     * rather than widening it: there is never more than one live code per user.
     */
    private void issueAndSendCode(User user) {
        tokenRepository.invalidateAllForUser(user.getId(), OffsetDateTime.now(clock));

        String code = generateCode();
        tokenRepository.save(new LoginCode(
            user.getId(),
            hashLoginCode(user.getId(), code),
            OffsetDateTime.now(clock).plus(CODE_TTL)
        ));
        sendCodeEmail(user, code);
    }

    /** Zero-padded so every code is exactly six digits — "004182", never "4182". */
    private static String generateCode() {
        return String.format("%0" + CODE_DIGITS + "d", RANDOM.nextInt(CODE_BOUND));
    }

    /**
     * Salts the code with the user id before hashing. A bare six-digit code has
     * only a million possible hashes, which anyone can precompute; folding in the
     * user id forces that work to be redone per user. It does not make a database
     * leak safe — see {@code V32__login_code_attempts.sql} for the trade-off
     * accepted here.
     */
    private static String hashLoginCode(UUID userId, String code) {
        return TokenUtils.sha256(userId + ":" + code);
    }

    private void sendCodeEmail(User user, String code) {
        String greetingName = user.getFullName() != null && !user.getFullName().isBlank()
            ? user.getFullName() : "there";
        long minutes = CODE_TTL.toMinutes();
        // Letter-spaced and oversized because the whole point is that it can be
        // read off a phone at a glance and typed into the tab already open.
        String codeBlock = "<p style=\"font-size:32px;font-weight:700;letter-spacing:8px;"
            + "text-align:center;margin:24px 0;font-family:monospace;\">"
            + HtmlEscape.escape(code) + "</p>";
        String html = EmailTemplate.document(
            "Your Fotolio sign-in code — expires in " + minutes + " minutes.",
            EmailTemplate.heading("Your sign-in code")
                + EmailTemplate.paragraph("Hi " + HtmlEscape.escape(greetingName)
                    + ", enter this code in the tab you already have open. "
                    + "No password needed.")
                + codeBlock
                + EmailTemplate.note("This code expires in " + minutes
                    + " minutes and can only be used once. If you didn't request it, "
                    + "you can safely ignore this email."));
        try {
            emailService.send(new EmailMessage(
                user.getEmail(), "Your sign-in code: " + code, html,
                EmailType.LOGIN_CODE, user.getTenantId()));
        } catch (RuntimeException ex) {
            LOG.warn("Failed to send login-code email to {}", user.getEmail(), ex);
        }
    }

    private void enforceRateLimit(String key, int max) {
        rateLimiter.check(key, max, REQUEST_WINDOW,
            "Too many login attempts. Please try again later.");
    }


}
