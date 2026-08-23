package com.photographplatform.api.auth.service;

import com.photographplatform.api.auth.domain.RefreshToken;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.AuthResult;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.MeResponse;
import com.photographplatform.api.auth.dto.RefreshRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.auth.dto.UpdateProfileRequest;
import com.photographplatform.api.auth.repository.RefreshTokenRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.billing.config.BillingProperties;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.security.RateLimiter;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.common.util.TokenUtils;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class AuthService {

    private static final Logger LOG = LoggerFactory.getLogger(AuthService.class);

    // Login lockout
    private static final int LOGIN_MAX_FAILED_PER_EMAIL = 5;
    private static final int LOGIN_MAX_FAILED_PER_IP = 20;
    private static final Duration LOGIN_LOCKOUT_DURATION = Duration.ofMinutes(15);

    // Register rate limit
    private static final int REGISTER_MAX_PER_IP_PER_HOUR = 5;
    private static final Duration REGISTER_WINDOW = Duration.ofHours(1);


    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final StringRedisTemplate redis;
    private final RateLimiter rateLimiter;
    private final AuditService auditService;
    private final EmailVerificationService emailVerificationService;
    private final AvatarUrlResolver avatarUrlResolver;
    private final SessionRevocation sessionRevocation;
    private final BillingProperties billingProperties;
    private final Clock clock;
    private final long refreshTokenExpiryMs;
    /** See {@link #login} for why that method drives transactions by hand. */
    private final TransactionTemplate readOnlyTransaction;
    private final TransactionTemplate writeTransaction;

    /**
     * BCrypt hash computed once at startup over a value that never matches any real
     * password. Used to equalize timing on login when the email is unknown so that
     * the response time does not reveal account existence.
     */
    private final String dummyBcryptHash;

    public AuthService(
        TenantRepository tenantRepository,
        UserRepository userRepository,
        RefreshTokenRepository refreshTokenRepository,
        JwtService jwtService,
        PasswordEncoder passwordEncoder,
        StringRedisTemplate redis,
        RateLimiter rateLimiter,
        AuditService auditService,
        EmailVerificationService emailVerificationService,
        AvatarUrlResolver avatarUrlResolver,
        SessionRevocation sessionRevocation,
        BillingProperties billingProperties,
        Clock clock,
        PlatformTransactionManager transactionManager,
        @Value("${app.jwt.refresh-token-expiry-ms}") long refreshTokenExpiryMs
    ) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.redis = redis;
        this.rateLimiter = rateLimiter;
        this.auditService = auditService;
        this.emailVerificationService = emailVerificationService;
        this.avatarUrlResolver = avatarUrlResolver;
        this.sessionRevocation = sessionRevocation;
        this.billingProperties = billingProperties;
        this.clock = clock;
        this.refreshTokenExpiryMs = refreshTokenExpiryMs;
        this.readOnlyTransaction = new TransactionTemplate(transactionManager);
        this.readOnlyTransaction.setReadOnly(true);
        this.writeTransaction = new TransactionTemplate(transactionManager);
        this.dummyBcryptHash = passwordEncoder.encode(
            "timing-equalization-placeholder-" + UUID.randomUUID());
    }

    // ── Register ──────────────────────────────────────────────────────────────

    @Transactional
    public AuthResult register(RegisterRequest req, String ipAddress) {
        checkRegisterRateLimit(ipAddress);

        String normalizedEmail = Normalize.email(req.email());
        String normalizedSubdomain = Normalize.lower(req.subdomain());

        if (ReservedSubdomains.isReserved(normalizedSubdomain)) {
            // A reserved name can never be granted — that's invalid input (400),
            // not a conflict with an existing tenant (409, below).
            throw new IllegalArgumentException("This subdomain is reserved. Please choose another.");
        }
        if (tenantRepository.existsBySubdomain(normalizedSubdomain)) {
            throw new ConflictException("Subdomain already taken");
        }
        // Staff-scoped, not global: having been someone else's client must not
        // bar you from opening your own studio, and that person is exactly who
        // signs up. The DB backs this with uq_users_staff_email, so the race
        // between this check and the insert below lands in the
        // DataIntegrityViolationException handler rather than creating a second
        // account.
        if (userRepository.existsStaffByEmail(normalizedEmail)) {
            throw new ConflictException("Email already in use");
        }

        Tenant tenant;
        try {
            Tenant fresh = new Tenant(normalizedSubdomain, normalizedEmail);
            // The plan picked on the pricing page selects which tier the trial
            // runs on — every tier is free for the trial window, so trusting
            // the client here still grants nothing it would not otherwise get.
            // What changed is that the grant is now time-boxed: without the
            // trial deadline below, a POST of plan=STUDIO bought Studio
            // forever, for free. RegisterRequest's javadoc called that out as
            // the thing to fix "the moment plan gates or billing land".
            //
            // After the trial the plan comes from the Stripe subscription, not
            // from here — see BillingService.
            if (req.plan() != null && !req.plan().isBlank()) {
                fresh.setPlan(Plan.from(req.plan()));
            }
            fresh.setTrialEndsAt(
                OffsetDateTime.now(clock).plusDays(billingProperties.getTrialDays()));
            tenant = tenantRepository.save(fresh);
        } catch (DataIntegrityViolationException ex) {
            // Race: two registrations sharing the same subdomain or email.
            throw new ConflictException("Subdomain or email already taken");
        }

        // Tenant isolation is RLS-enforced against the shared schema (see
        // V11__tenant_rls.sql) — creating a tenant is now a plain row insert,
        // no schema DDL and no compensating rollback to worry about.
        User user = new User(
            tenant.getId(),
            normalizedEmail,
            passwordEncoder.encode(req.password()),
            req.fullName().trim()
        );
        user.setRole(req.role());
        userRepository.save(user);

        // Best-effort: issue + send verification email. Persistence failures
        // here would roll back the registration (token row is in the same tx),
        // but mail-delivery failures are swallowed inside the service.
        emailVerificationService.issueAndSend(user);

        auditService.logQuietly("USER_REGISTERED", "USER", user.getId(),
            tenant.getId(), user.getId(), ipAddress);

        return buildAuthResult(user, tenant);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    /**
     * Deliberately not {@code @Transactional} as a whole.
     *
     * <p>BCrypt at cost 12 is ~250ms of CPU by design — that cost is the point
     * of the algorithm. Inside a transaction it is also ~250ms holding one of
     * the ten connections in the pool, because Hibernate acquires on the first
     * statement and releases at commit. The lookup below comes first, so every
     * login (and every <em>failed</em> login, which runs the same hash against a
     * dummy to equalise timing) pinned a connection for the whole hash.
     *
     * <p>At that rate a burst of failed sign-ins exhausts the pool and takes
     * down endpoints that have nothing to do with authentication — a cheap
     * denial of service that costs the attacker one HTTP request each.
     *
     * <p>So the work is split: read, hash outside any transaction, then write.
     * The two short transactions cost one extra connection acquisition and
     * remove the long hold entirely.
     */
    public AuthResult login(LoginRequest req, String ipAddress) {
        String normalizedEmail = Normalize.email(req.email());
        String emailLockKey = "login:lock:email:" + normalizedEmail;
        String emailFailKey = "login:fail:email:" + normalizedEmail;
        String ipLockKey = "login:lock:ip:" + ipAddress;
        String ipFailKey = "login:fail:ip:" + ipAddress;

        if (Boolean.TRUE.equals(redis.hasKey(emailLockKey))
            || Boolean.TRUE.equals(redis.hasKey(ipLockKey))) {
            throw new UnauthorizedException("Invalid credentials");
        }

        // Staff only. This endpoint takes an email and a password with no tenant
        // hint, so the address must resolve to exactly one account — which is
        // true for PHOTOGRAPHER/ADMIN (uq_users_staff_email) and deliberately
        // untrue for customers, who may hold one row per photographer they hire.
        // Customers are passwordless anyway, so none could authenticate here.
        // Short read transaction; the connection goes back to the pool before
        // the expensive part starts.
        Optional<User> userOpt = readOnlyTransaction.execute(
            status -> userRepository.findStaffByEmail(normalizedEmail));

        // Outside any transaction. Still always runs — hashing only when the
        // address exists would make response time an account-existence oracle.
        boolean passwordValid;
        if (userOpt != null && userOpt.isPresent() && userOpt.get().getPasswordHash() != null) {
            passwordValid = passwordEncoder.matches(req.password(), userOpt.get().getPasswordHash());
        } else {
            passwordEncoder.matches(req.password(), dummyBcryptHash);
            passwordValid = false;
        }

        if (!passwordValid) {
            registerLoginFailure(emailFailKey, emailLockKey, LOGIN_MAX_FAILED_PER_EMAIL);
            registerLoginFailure(ipFailKey, ipLockKey, LOGIN_MAX_FAILED_PER_IP);
            throw new UnauthorizedException("Invalid credentials");
        }

        // Success — clear the email-bound counter (IP counter naturally expires)
        redis.delete(emailFailKey);

        UUID userId = userOpt.orElseThrow().getId();

        // Re-read inside the write transaction: the instance above is detached,
        // and buildAuthResult persists a refresh token that must commit with the
        // last-login stamp.
        return writeTransaction.execute(status -> {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));
            Tenant tenant = tenantRepository.findById(user.getTenantId())
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));

            user.setLastLoginAt(OffsetDateTime.now(clock));
            userRepository.save(user);

            auditService.logQuietly("USER_LOGIN", "USER", user.getId(),
                tenant.getId(), user.getId(), ipAddress);

            return buildAuthResult(user, tenant);
        });
    }

    // ── Refresh ───────────────────────────────────────────────────────────────

    @Transactional
    public AuthResult refresh(RefreshRequest req) {
        if (req == null || req.refreshToken() == null || req.refreshToken().isBlank()) {
            throw new UnauthorizedException("No refresh token provided");
        }
        String tokenHash = TokenUtils.sha256(req.refreshToken());
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
            .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        if (stored.isUsed() || stored.getExpiresAt().isBefore(OffsetDateTime.now(clock))) {
            // Reuse / expiry detected — invalidate the entire family for safety.
            refreshTokenRepository.invalidateAllForUser(stored.getUserId());
            throw new UnauthorizedException("Refresh token reuse detected");
        }

        stored.setUsed(true);
        refreshTokenRepository.save(stored);

        User user = userRepository.findById(stored.getUserId())
            .orElseThrow(() -> new UnauthorizedException("User not found"));
        Tenant tenant = tenantRepository.findById(stored.getTenantId())
            .orElseThrow(() -> new UnauthorizedException("Tenant not found"));

        return buildAuthResult(user, tenant);
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    /**
     * Ends the session on both halves of it.
     *
     * <p>Invalidating the refresh token alone left the access token working for
     * the rest of its 24 hours, because a JWT carries its own authority and the
     * filter had nothing to check it against. "Sign out" therefore did not sign
     * anyone out until their token happened to expire.
     */
    @Transactional
    public void logout(UUID userId) {
        if (userId == null) {
            return; // idempotent
        }
        refreshTokenRepository.invalidateAllForUser(userId);
        sessionRevocation.revokeAllFor(userId);
    }

    // ── Me ────────────────────────────────────────────────────────────────────

    /**
     * {@code readOnly} matters here beyond skipping dirty-checking: without
     * any transaction the two lookups below each ran in their own implicit
     * one, so each borrowed a pooled connection and each paid the
     * {@code SELECT set_config('app.tenant_id', …)} round-trip that
     * {@link com.photographplatform.api.common.config.TenantRoutingDataSource}
     * issues per connection acquisition. {@code /api/auth/me} is called on
     * every page load, so that was double the connection churn and double the
     * tenant-binding latency on the app's most frequent request.
     */
    @Transactional(readOnly = true)
    public MeResponse me(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new UnauthorizedException("User not found"));
        Tenant tenant = tenantRepository.findById(user.getTenantId())
            .orElseThrow(() -> new UnauthorizedException("Tenant not found"));
        return toMeResponse(user, tenant);
    }

    private static final Pattern SUBDOMAIN_PATTERN =
        Pattern.compile("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$");

    /**
     * Applies a partial profile update for the signed-in user. Only the
     * non-null fields of the request are touched, so the Profile and Studio
     * sections of the settings page can each save independently.
     */
    @Transactional
    public MeResponse updateProfile(UUID userId, UpdateProfileRequest req) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new UnauthorizedException("User not found"));
        Tenant tenant = tenantRepository.findById(user.getTenantId())
            .orElseThrow(() -> new UnauthorizedException("Tenant not found"));

        if (req.fullName() != null) {
            String name = req.fullName().trim();
            if (name.isEmpty()) {
                throw new IllegalArgumentException("Full name cannot be empty.");
            }
            user.setFullName(name);
            userRepository.save(user);
        }

        if (req.subdomain() != null) {
            String subdomain = Normalize.lower(req.subdomain());
            // Only validate/persist when it actually changes — re-saving the
            // current value must never trip the uniqueness check.
            if (!subdomain.equals(tenant.getSubdomain())) {
                if (!SUBDOMAIN_PATTERN.matcher(subdomain).matches()) {
                    throw new IllegalArgumentException(
                        "Subdomain must be 3-63 characters, start and end with a letter or "
                            + "number, and may contain hyphens in between.");
                }
                if (ReservedSubdomains.isReserved(subdomain)) {
                    // Reserved name = invalid input (400), consistent with the
                    // malformed-subdomain check above and register().
                    throw new IllegalArgumentException("This subdomain is reserved. Please choose another.");
                }
                if (tenantRepository.existsBySubdomain(subdomain)) {
                    throw new ConflictException("That subdomain is already taken.");
                }
                tenant.setSubdomain(subdomain);
                tenantRepository.save(tenant);
            }
        }

        if (req.avatarUrl() != null) {
            user.setAvatarUrl(req.avatarUrl().isBlank() ? null : req.avatarUrl().trim());
            userRepository.save(user);
        }

        return toMeResponse(user, tenant);
    }

    private MeResponse toMeResponse(User user, Tenant tenant) {
        return new MeResponse(
            user.getId(), user.getEmail(), user.getFullName(), user.getRole(),
            user.isEmailVerified(),
            new MeResponse.TenantInfo(tenant.getSubdomain(), tenant.getPlan()),
            avatarUrlResolver.resolve(user.getAvatarUrl())
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private AuthResult buildAuthResult(User user, Tenant tenant) {
        String accessToken = jwtService.generateToken(user.getId(), tenant.getId(), user.getRole());
        String rawRefresh = TokenUtils.generateSecureToken();
        String refreshHash = TokenUtils.sha256(rawRefresh);

        refreshTokenRepository.save(new RefreshToken(
            user.getId(),
            tenant.getId(),
            refreshHash,
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
     * Not a plain limiter: on reaching the threshold it writes a separate lock
     * key that refuses even correct credentials for the lockout period, which
     * is why it needs the running count rather than a yes/no.
     */
    private void registerLoginFailure(String countKey, String lockKey, int max) {
        Long count = rateLimiter.hit(countKey, LOGIN_LOCKOUT_DURATION);
        if (count != null && count >= max) {
            redis.opsForValue().set(lockKey, "1", LOGIN_LOCKOUT_DURATION);
        }
    }

    private void checkRegisterRateLimit(String ipAddress) {
        if (ipAddress == null || ipAddress.isBlank()) {
            return;
        }
        rateLimiter.check("register:rate:" + ipAddress, REGISTER_MAX_PER_IP_PER_HOUR,
            REGISTER_WINDOW, "Too many registration attempts. Please try again later.");
    }

    /**
     * Audit logging is best-effort and must never fail registration / login.
     * The {@link AuditService} is {@code @Async}, but exceptions thrown when
     * scheduling the task or by the logger itself should still be swallowed.
     */


}
