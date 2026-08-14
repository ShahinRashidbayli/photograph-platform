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
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.TooManyRequestsException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.common.util.TokenUtils;
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
import org.springframework.transaction.annotation.Transactional;

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
    private final AuditService auditService;
    private final EmailVerificationService emailVerificationService;
    private final long refreshTokenExpiryMs;

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
        AuditService auditService,
        EmailVerificationService emailVerificationService,
        @Value("${app.jwt.refresh-token-expiry-ms}") long refreshTokenExpiryMs
    ) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.redis = redis;
        this.auditService = auditService;
        this.emailVerificationService = emailVerificationService;
        this.refreshTokenExpiryMs = refreshTokenExpiryMs;
        this.dummyBcryptHash = passwordEncoder.encode(
            "timing-equalization-placeholder-" + UUID.randomUUID());
    }

    // ── Register ──────────────────────────────────────────────────────────────

    @Transactional
    public AuthResult register(RegisterRequest req, String ipAddress) {
        checkRegisterRateLimit(ipAddress);

        String normalizedEmail = req.email().trim().toLowerCase();
        String normalizedSubdomain = req.subdomain().trim().toLowerCase();

        if (ReservedSubdomains.isReserved(normalizedSubdomain)) {
            // A reserved name can never be granted — that's invalid input (400),
            // not a conflict with an existing tenant (409, below).
            throw new IllegalArgumentException("This subdomain is reserved. Please choose another.");
        }
        if (tenantRepository.existsBySubdomain(normalizedSubdomain)) {
            throw new ConflictException("Subdomain already taken");
        }
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new ConflictException("Email already in use");
        }

        Tenant tenant;
        try {
            Tenant fresh = new Tenant(normalizedSubdomain, normalizedEmail);
            // Honour the plan chosen on the pricing page; the entity already
            // defaults to STARTER when the signup came from elsewhere.
            if (req.plan() != null && !req.plan().isBlank()) {
                fresh.setPlan(req.plan());
            }
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

        tryAudit("USER_REGISTERED", "USER", user.getId(),
            tenant.getId(), user.getId(), ipAddress);

        return buildAuthResult(user, tenant);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    @Transactional
    public AuthResult login(LoginRequest req, String ipAddress) {
        String normalizedEmail = req.email().trim().toLowerCase();
        String emailLockKey = "login:lock:email:" + normalizedEmail;
        String emailFailKey = "login:fail:email:" + normalizedEmail;
        String ipLockKey = "login:lock:ip:" + ipAddress;
        String ipFailKey = "login:fail:ip:" + ipAddress;

        if (Boolean.TRUE.equals(redis.hasKey(emailLockKey))
            || Boolean.TRUE.equals(redis.hasKey(ipLockKey))) {
            throw new UnauthorizedException("Invalid credentials");
        }

        Optional<User> userOpt = userRepository.findByEmail(normalizedEmail);

        // Equalize timing by always running BCrypt — even if the email is unknown.
        boolean passwordValid;
        if (userOpt.isPresent() && userOpt.get().getPasswordHash() != null) {
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

        User user = userOpt.orElseThrow();
        Tenant tenant = tenantRepository.findById(user.getTenantId())
            .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));

        user.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(user);

        tryAudit("USER_LOGIN", "USER", user.getId(),
            tenant.getId(), user.getId(), ipAddress);

        return buildAuthResult(user, tenant);
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

        if (stored.isUsed() || stored.getExpiresAt().isBefore(OffsetDateTime.now())) {
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

    @Transactional
    public void logout(UUID userId) {
        if (userId == null) {
            return; // idempotent
        }
        refreshTokenRepository.invalidateAllForUser(userId);
    }

    // ── Me ────────────────────────────────────────────────────────────────────

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
            String subdomain = req.subdomain().trim().toLowerCase();
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
            user.getAvatarUrl()
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
            OffsetDateTime.now().plus(Duration.ofMillis(refreshTokenExpiryMs))
        ));

        AuthResponse response = new AuthResponse(
            user.getId(),
            user.getEmail(),
            user.getFullName(),
            user.getRole(),
            user.isEmailVerified(),
            new AuthResponse.TenantInfo(tenant.getSubdomain(), tenant.getPlan()),
            user.getAvatarUrl()
        );
        return new AuthResult(response, accessToken, rawRefresh);
    }

    private void registerLoginFailure(String countKey, String lockKey, int max) {
        Long count = redis.opsForValue().increment(countKey);
        if (count != null && count == 1) {
            redis.expire(countKey, LOGIN_LOCKOUT_DURATION);
        }
        if (count != null && count >= max) {
            redis.opsForValue().set(lockKey, "1", LOGIN_LOCKOUT_DURATION);
        }
    }

    private void checkRegisterRateLimit(String ipAddress) {
        if (ipAddress == null || ipAddress.isBlank()) {
            return;
        }
        String key = "register:rate:" + ipAddress;
        Long count = redis.opsForValue().increment(key);
        if (count != null && count == 1) {
            redis.expire(key, REGISTER_WINDOW);
        }
        if (count != null && count > REGISTER_MAX_PER_IP_PER_HOUR) {
            throw new TooManyRequestsException(
                "Too many registration attempts. Please try again later.");
        }
    }

    /**
     * Audit logging is best-effort and must never fail registration / login.
     * The {@link AuditService} is {@code @Async}, but exceptions thrown when
     * scheduling the task or by the logger itself should still be swallowed.
     */
    private void tryAudit(String action, String entityType, UUID entityId,
                          UUID tenantId, UUID actorId, String ipAddress) {
        try {
            auditService.log(action, entityType, entityId, tenantId, actorId, ipAddress);
        } catch (RuntimeException ex) {
            LOG.warn("Audit log failed for {} on {}", action, entityId, ex);
        }
    }


}
