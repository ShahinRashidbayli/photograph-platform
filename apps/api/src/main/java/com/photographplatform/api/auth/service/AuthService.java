package com.photographplatform.api.auth.service;

import com.photographplatform.api.auth.domain.RefreshToken;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.MeResponse;
import com.photographplatform.api.auth.dto.RefreshRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.auth.repository.RefreshTokenRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.exception.ConflictException;
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
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration LOCKOUT_DURATION = Duration.ofMinutes(15);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final TenantSchemaInitializer schemaInitializer;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final StringRedisTemplate redis;
    private final long refreshTokenExpiryMs;

    public AuthService(
        TenantRepository tenantRepository,
        UserRepository userRepository,
        RefreshTokenRepository refreshTokenRepository,
        TenantSchemaInitializer schemaInitializer,
        JwtService jwtService,
        PasswordEncoder passwordEncoder,
        StringRedisTemplate redis,
        @Value("${app.jwt.refresh-token-expiry-ms}") long refreshTokenExpiryMs
    ) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.schemaInitializer = schemaInitializer;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.redis = redis;
        this.refreshTokenExpiryMs = refreshTokenExpiryMs;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (tenantRepository.existsBySubdomain(req.subdomain())) {
            throw new ConflictException("Subdomain already taken");
        }

        Tenant tenant = tenantRepository.save(new Tenant(req.subdomain(), req.email()));
        schemaInitializer.initializeSchema(tenant.getId().toString());

        User user = userRepository.save(new User(
            tenant.getId(),
            req.email(),
            passwordEncoder.encode(req.password()),
            req.fullName()
        ));

        return buildAuthResponse(user, tenant);
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        String lockKey = "login:lock:" + req.email();
        String countKey = "login:fail:" + req.email();

        if (Boolean.TRUE.equals(redis.hasKey(lockKey))) {
            throw new UnauthorizedException("Invalid credentials");
        }

        User user = userRepository.findByEmail(req.email())
            .filter(u -> u.getPasswordHash() != null
                && passwordEncoder.matches(req.password(), u.getPasswordHash()))
            .orElseGet(() -> {
                incrementFailCount(countKey, lockKey);
                throw new UnauthorizedException("Invalid credentials");
            });

        redis.delete(countKey);

        Tenant tenant = tenantRepository.findById(user.getTenantId())
            .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));

        user.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(user);

        return buildAuthResponse(user, tenant);
    }

    @Transactional
    public AuthResponse refresh(RefreshRequest req) {
        String tokenHash = sha256(req.refreshToken());
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
            .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        if (stored.isUsed() || stored.getExpiresAt().isBefore(OffsetDateTime.now())) {
            refreshTokenRepository.invalidateAllForUser(stored.getUserId());
            throw new UnauthorizedException("Refresh token reuse detected");
        }

        stored.setUsed(true);
        refreshTokenRepository.save(stored);

        User user = userRepository.findById(stored.getUserId())
            .orElseThrow(() -> new UnauthorizedException("User not found"));
        Tenant tenant = tenantRepository.findById(stored.getTenantId())
            .orElseThrow(() -> new UnauthorizedException("Tenant not found"));

        return buildAuthResponse(user, tenant);
    }

    @Transactional
    public void logout(UUID userId) {
        refreshTokenRepository.invalidateAllForUser(userId);
    }

    public MeResponse me(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new UnauthorizedException("User not found"));
        Tenant tenant = tenantRepository.findById(user.getTenantId())
            .orElseThrow(() -> new UnauthorizedException("Tenant not found"));
        return new MeResponse(
            user.getId(), user.getEmail(), user.getFullName(), user.getRole(),
            new MeResponse.TenantInfo(tenant.getSubdomain(), tenant.getPlan())
        );
    }

    private AuthResponse buildAuthResponse(User user, Tenant tenant) {
        String accessToken = jwtService.generateToken(user.getId(), tenant.getId(), user.getRole());
        String rawRefresh = generateSecureToken();
        String refreshHash = sha256(rawRefresh);

        refreshTokenRepository.save(new RefreshToken(
            user.getId(),
            tenant.getId(),
            refreshHash,
            OffsetDateTime.now().plus(Duration.ofMillis(refreshTokenExpiryMs))
        ));

        return new AuthResponse(
            accessToken,
            rawRefresh,
            new AuthResponse.TenantInfo(tenant.getSubdomain(), tenant.getPlan())
        );
    }

    private void incrementFailCount(String countKey, String lockKey) {
        Long count = redis.opsForValue().increment(countKey);
        if (count != null && count == 1) {
            redis.expire(countKey, LOCKOUT_DURATION);
        }
        if (count != null && count >= MAX_FAILED_ATTEMPTS) {
            redis.opsForValue().set(lockKey, "1", LOCKOUT_DURATION);
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
