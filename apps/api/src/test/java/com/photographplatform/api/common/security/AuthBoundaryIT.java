package com.photographplatform.api.common.security;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The 401/403 boundary, and the response shape on either side of it.
 *
 * <h2>Why this suite exists</h2>
 * {@code SecurityConfig} declared no {@link
 * org.springframework.security.web.AuthenticationEntryPoint}, so Spring
 * Security fell back to {@code Http403ForbiddenEntryPoint} and answered
 * <b>403</b> for every unauthenticated request — including one whose access
 * token had merely expired.
 *
 * <p>The frontend interceptor refreshes on 401 and rethrows everything else, so
 * the whole refresh-token rotation path was dead: 24 hours after signing in,
 * users were bounced to the login screen instead of being renewed. Nothing was
 * wrong with the refresh code; the status code meant it was never reached.
 *
 * <p>Nothing caught it. The one test that touched this path asserted only
 * {@code is4xxClientError()}, which 403 satisfies perfectly. So these assertions
 * are deliberately exact: the distinction between the two statuses <em>is</em>
 * the contract, and a test that accepts either is not testing it.
 */
class AuthBoundaryIT extends IntegrationTestBase {

    // Test-only credential — not a real secret. pragma: allowlist secret
    private static final String TEST_PASSWORD = "Password1234";
    private static final String PROTECTED_ENDPOINT = "/api/leads";

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private JwtService jwtService;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @BeforeEach
    void setup() {
        mockRedisNoLock();
    }

    // ── 401: credentials missing or stale, refreshing might help ─────────────

    @Test
    void noCredentialsIs401() {
        ResponseEntity<Map<String, Object>> resp = get(PROTECTED_ENDPOINT, new HttpHeaders());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    /**
     * The case the whole fix is about. An expired token is syntactically valid
     * and correctly signed — it simply aged out — and the only sane answer is
     * "refresh and try again", which 403 does not say.
     */
    @Test
    void expiredTokenIs401SoTheClientKnowsToRefresh() {
        ResponseEntity<Map<String, Object>> resp =
            get(PROTECTED_ENDPOINT, bearer(expiredToken("PHOTOGRAPHER")));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void malformedTokenIs401() {
        ResponseEntity<Map<String, Object>> resp =
            get(PROTECTED_ENDPOINT, bearer("not.a.jwt"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ── 403: authenticated fine, just not allowed ───────────────────────────

    /**
     * The other half of the contract. A CUSTOMER token authenticates perfectly
     * and refreshing it produces another CUSTOMER token, so answering 401 here
     * would send the client into a refresh loop that can never succeed.
     */
    @Test
    void validTokenWithWrongRoleIs403NotAn401RefreshLoop() {
        UUID tenantId = registerPhotographerAndReadTenantId();
        String customerToken = jwtService.generateToken(UUID.randomUUID(), tenantId, "CUSTOMER");

        ResponseEntity<Map<String, Object>> resp = get(PROTECTED_ENDPOINT, bearer(customerToken));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ── shape: one body for every error, security chain included ─────────────

    /**
     * The filter chain never reaches {@code GlobalExceptionHandler}, so it used
     * to answer Boot's default body — whose {@code error} field holds the status
     * <em>name</em>. The frontend reads {@code data.error} everywhere, which is
     * how the literal string "Forbidden" ended up rendered at users.
     */
    @Test
    void securityChainErrorsCarryTheSameBodyAsApplicationErrors() {
        ResponseEntity<Map<String, Object>> resp = get(PROTECTED_ENDPOINT, new HttpHeaders());

        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody()).containsKey("code");
        assertThat(resp.getBody()).containsKey("timestamp");
        assertThat(resp.getBody().get("code")).isEqualTo("UNAUTHORIZED");
        assertThat(resp.getBody().get("path")).isEqualTo(PROTECTED_ENDPOINT);
        // A message written for a person, not the status name.
        assertThat((String) resp.getBody().get("error")).isNotEqualTo("Unauthorized");
        assertThat((String) resp.getBody().get("error")).contains("signed in");
    }

    @Test
    void applicationErrorsCarryACodeToo() {
        ResponseEntity<Map<String, Object>> resp =
            get("/api/public/portfolio/no-such-photographer", new HttpHeaders());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().get("code")).isEqualTo("NOT_FOUND");
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /**
     * Signed with the real key so it passes signature verification and fails
     * only on {@code exp} — anything else would be testing a different bug.
     */
    private String expiredToken(String role) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        long now = System.currentTimeMillis();
        return Jwts.builder()
            .subject(UUID.randomUUID().toString())
            .claim("tenant_id", UUID.randomUUID().toString())
            .claim("role", role)
            .issuedAt(new Date(now - 172_800_000L))
            .expiration(new Date(now - 86_400_000L))
            .signWith(key)
            .compact();
    }

    private UUID registerPhotographerAndReadTenantId() {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Alice", "alice@a.com", TEST_PASSWORD, "tenant-a",
                "PHOTOGRAPHER", "STARTER"),
            AuthResponse.class);
        ResponseEntity<AuthResponse> login = rest.postForEntity("/api/auth/login",
            new LoginRequest("alice@a.com", TEST_PASSWORD), AuthResponse.class);
        String token = extractCookie(login, "access_token");
        assertThat(token).isNotBlank();
        Claims claims = jwtService.validateToken(token)
            .orElseThrow(() -> new IllegalStateException("photographer token did not validate"));
        return UUID.fromString(claims.get("tenant_id", String.class));
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private ResponseEntity<Map<String, Object>> get(String path, HttpHeaders headers) {
        return (ResponseEntity) rest.exchange(
            path, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    }

    private HttpHeaders bearer(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        return h;
    }
}
