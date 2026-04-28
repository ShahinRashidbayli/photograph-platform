package com.photographplatform.api.auth.service;

import com.photographplatform.api.auth.domain.RefreshToken;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.AuthResult;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.MeResponse;
import com.photographplatform.api.auth.dto.RefreshRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.auth.repository.RefreshTokenRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.TooManyRequestsException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.tenant.service.TenantSchemaInitializer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
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

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final TenantSchemaInitializer schemaInitializer;
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
        TenantSchemaInitializer schemaInitializer,
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
        this.schemaInitializer = schemaInitializer;
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
            throw new ConflictException("This subdomain is reserved. Please choose another.");
        }
        if (tenantRepository.existsBySubdomain(normalizedSubdomain)) {
            throw new ConflictException("Subdomain already taken");
        }
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new ConflictException("Email already in use");
        }

        Tenant tenant;
        try {
            tenant = tenantRepository.save(new Tenant(normalizedSubdomain, normalizedEmail));
        } catch (DataIntegrityViolationException ex) {
            // Race: two registrations sharing the same subdomain or email.
            throw new ConflictException("Subdomain or email already taken");
        }
        String tenantId = tenant.getId().toString();

        try {
            schemaInitializer.initializeSchema(tenantId);
        } catch (RuntimeException ex) {
            // DDL never reached committed state — nothing to compensate.
            LOG.error("Schema init failed for tenant {}", tenantId, ex);
            throw ex;
        }

        try {
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
        } catch (RuntimeException ex) {
            // Schema is already committed (Flyway uses its own connection); JPA will roll
            // back tenant + user inserts, so we explicitly drop the orphan schema.
            schemaInitializer.dropSchema(tenantId);
            throw ex;
        }
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
        String tokenHash = sha256(req.refreshToken());
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
        return new MeResponse(
            user.getId(), user.getEmail(), user.getFullName(), user.getRole(),
            user.isEmailVerified(),
            new MeResponse.TenantInfo(tenant.getSubdomain(), tenant.getPlan())
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private AuthResult buildAuthResult(User user, Tenant tenant) {
        String accessToken = jwtService.generateToken(user.getId(), tenant.getId(), user.getRole());
        String rawRefresh = generateSecureToken();
        String refreshHash = sha256(rawRefresh);

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
            new AuthResponse.TenantInfo(tenant.getSubdomain(), tenant.getPlan())
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

    private static String generateSecureToken() {
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
