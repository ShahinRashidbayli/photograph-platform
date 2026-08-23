package com.photographplatform.api.common.security;

import com.photographplatform.api.common.config.TenantContext;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The revocation half of token authentication.
 *
 * <p>Signature and expiry were the only questions this filter used to ask, and
 * a JWT answers both by itself. That is why a signed-out — or password-reset —
 * access token kept working for the rest of its 24 hours: nothing consulted any
 * state that a logout could change. These tests are about the check that closes
 * that, and about it failing closed when it cannot be made.
 */
class JwtAuthFilterTest {

    private static final String SECRET = "test-secret-that-is-at-least-32-bytes-long!!";
    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();

    private static final SecretKey KEY =
        Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));

    private TokenRevocationCheck revocationCheck;
    private JwtAuthFilter filter;

    @BeforeEach
    void setUp() {
        revocationCheck = mock(TokenRevocationCheck.class);
        when(revocationCheck.isTokenStillValid(any(), any())).thenReturn(true);
        filter = new JwtAuthFilter(new JwtService(SECRET, 86_400_000L), revocationCheck);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    private boolean authenticatesWith(String token) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/clients");
        request.addHeader("Authorization", "Bearer " + token);
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(request, new MockHttpServletResponse(), chain);
        return SecurityContextHolder.getContext().getAuthentication() != null;
    }

    /** A hand-rolled token, so `iat` and the subject can be made wrong on purpose. */
    private static String token(String subject, Instant issuedAt) {
        var builder = Jwts.builder()
            .subject(subject)
            .claim("tenant_id", TENANT_ID.toString())
            .claim("role", "PHOTOGRAPHER")
            .expiration(new Date(System.currentTimeMillis() + 3_600_000));
        if (issuedAt != null) {
            builder.issuedAt(Date.from(issuedAt));
        }
        return builder.signWith(KEY).compact();
    }

    @Test
    void aLiveSessionAuthenticates() throws Exception {
        assertThat(authenticatesWith(token(USER_ID.toString(), Instant.now()))).isTrue();
    }

    /**
     * The hole this closes: the token is perfectly valid — correct signature,
     * not expired — and must still be refused, because its owner signed out or
     * reset their password after it was issued.
     */
    @Test
    void aRevokedTokenIsRefusedDespiteAValidSignatureAndExpiry() throws Exception {
        Instant issuedAt = Instant.now().minusSeconds(60);
        when(revocationCheck.isTokenStillValid(eq(USER_ID), any())).thenReturn(false);

        assertThat(authenticatesWith(token(USER_ID.toString(), issuedAt))).isFalse();
    }

    @Test
    void theIssuedAtClaimIsWhatGetsChecked() throws Exception {
        Instant issuedAt = Instant.parse("2026-03-01T12:00:00Z");

        authenticatesWith(token(USER_ID.toString(), issuedAt));

        org.mockito.Mockito.verify(revocationCheck).isTokenStillValid(USER_ID, issuedAt);
    }

    // ── failing closed ──────────────────────────────────────────────────

    /**
     * No {@code iat} means the token cannot be placed relative to a revocation,
     * and a token that cannot be checked must lose. Every token this app issues
     * carries one, so this can only be a token from somewhere else.
     */
    @Test
    void aTokenWithNoIssuedAtIsRefusedRatherThanTrusted() throws Exception {
        assertThat(authenticatesWith(token(USER_ID.toString(), null))).isFalse();
    }

    @Test
    void aSubjectThatIsNotAUserIdIsRefused() throws Exception {
        assertThat(authenticatesWith(token("not-a-uuid", Instant.now()))).isFalse();
    }

    /** A refused token must not leave a tenant bound for the rest of the request. */
    @Test
    void aRefusedTokenBindsNoTenant() throws Exception {
        when(revocationCheck.isTokenStillValid(any(), any())).thenReturn(false);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/clients");
        request.addHeader("Authorization", "Bearer " + token(USER_ID.toString(), Instant.now()));
        FilterChain chain = mock(FilterChain.class);
        filter.doFilterInternal(request, new MockHttpServletResponse(), chain);

        assertThat(TenantContext.getTenant()).isNull();
    }
}
