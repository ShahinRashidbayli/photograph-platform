package com.photographplatform.api.portfolio;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.common.security.JwtService;
import io.jsonwebtoken.Claims;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Authorization tests for the portfolio management endpoints.
 *
 * <p>CUSTOMER-role accounts are issued JWTs scoped to the photographer's own
 * tenant (see {@code CustomerAuthService}). Authentication alone therefore does
 * not protect portfolio mutations — these endpoints must additionally require a
 * PHOTOGRAPHER/ADMIN role. This suite proves that the role rule in
 * {@code SecurityConfig} holds: a perfectly valid CUSTOMER token is rejected,
 * while a PHOTOGRAPHER token for the same tenant is allowed through.
 */
class PortfolioAuthorizationIT extends IntegrationTestBase {

    // Test-only credential — not a real secret. pragma: allowlist secret
    private static final String TEST_PASSWORD = "Password1234";
    private static final String PHOTOS_ENDPOINT = "/api/portfolio/photos";

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private JwtService jwtService;

    @BeforeEach
    void setup() {
        mockRedisNoLock();
    }

    /**
     * The threat model: a customer logs in (legitimately) and then points their
     * valid token at the photographer's portfolio management API. A 403 — not a
     * 401 — confirms the token authenticated successfully but was denied on role.
     */
    @Test
    void customerTokenIsForbiddenFromPortfolioManagement() {
        UUID tenantId = registerPhotographerAndGetTenantId();

        // A genuine CUSTOMER token scoped to the photographer's tenant — exactly
        // what CustomerAuthService.verifyMagicLink would mint.
        String customerToken = jwtService.generateToken(UUID.randomUUID(), tenantId, "CUSTOMER");

        ResponseEntity<String> listResp = rest.exchange(
            PHOTOS_ENDPOINT, HttpMethod.GET,
            new HttpEntity<>(bearerHeaders(customerToken)), String.class);
        assertThat(listResp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        ResponseEntity<String> uploadResp = rest.exchange(
            PHOTOS_ENDPOINT + "/initiate-upload", HttpMethod.POST,
            new HttpEntity<>("{}", jsonBearerHeaders(customerToken)), String.class);
        assertThat(uploadResp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        ResponseEntity<String> deleteResp = rest.exchange(
            PHOTOS_ENDPOINT + "/" + UUID.randomUUID(), HttpMethod.DELETE,
            new HttpEntity<>(bearerHeaders(customerToken)), String.class);
        assertThat(deleteResp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    /**
     * Same URL, same tenant — only the role differs. The photographer must get
     * through, otherwise the rule is just blanket-denying the path.
     */
    @Test
    void photographerTokenIsAllowedIntoPortfolioManagement() {
        registerPhotographerAndGetTenantId();
        ResponseEntity<AuthResponse> login = rest.postForEntity("/api/auth/login",
            new LoginRequest("alice@a.com", TEST_PASSWORD), AuthResponse.class);
        String photographerToken = extractCookie(login, "access_token");
        assertThat(photographerToken).isNotBlank();

        ResponseEntity<String> listResp = rest.exchange(
            PHOTOS_ENDPOINT, HttpMethod.GET,
            new HttpEntity<>(bearerHeaders(photographerToken)), String.class);
        assertThat(listResp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void unauthenticatedIsDeniedFromPortfolioManagement() {
        ResponseEntity<String> resp = rest.getForEntity(PHOTOS_ENDPOINT, String.class);
        assertThat(resp.getStatusCode().is4xxClientError()).isTrue();
        assertThat(resp.getStatusCode().is2xxSuccessful()).isFalse();
    }

    /** Registers a photographer and returns the tenant UUID carried in its JWT. */
    private UUID registerPhotographerAndGetTenantId() {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Alice", "alice@a.com", TEST_PASSWORD, "tenant-a", "PHOTOGRAPHER", "STARTER"),
            AuthResponse.class);
        ResponseEntity<AuthResponse> login = rest.postForEntity("/api/auth/login",
            new LoginRequest("alice@a.com", TEST_PASSWORD), AuthResponse.class);
        String token = extractCookie(login, "access_token");
        assertThat(token).isNotBlank();
        Claims claims = jwtService.validateToken(token)
            .orElseThrow(() -> new IllegalStateException("photographer token did not validate"));
        return UUID.fromString(claims.get("tenant_id", String.class));
    }

    private HttpHeaders bearerHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        return h;
    }

    private HttpHeaders jsonBearerHeaders(String token) {
        HttpHeaders h = bearerHeaders(token);
        h.add(HttpHeaders.CONTENT_TYPE, "application/json");
        return h;
    }
}
