package com.photographplatform.api.auth;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.MeResponse;
import com.photographplatform.api.auth.dto.RegisterRequest;
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

class TenantIsolationIT extends IntegrationTestBase {

    // Test-only credential — not a real secret. pragma: allowlist secret
    private static final String TEST_PASSWORD = "Password1234";

    @Autowired
    private TestRestTemplate rest;

    @BeforeEach
    void setup() {
        mockRedisNoLock();
    }

    /**
     * Verifies that a JWT is scoped to the user it was issued for — /me always
     * returns the caller's own data regardless of other tenants in the system.
     * Full schema-level isolation (Tenant A cannot read Tenant B's photos, bookings
     * etc.) will be covered in Sprint 2 integration tests once those endpoints exist.
     */
    @Test
    void jwtScopedToItsOwnTenant() {
        // Register two tenants
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Alice", "alice@a.com", TEST_PASSWORD, "tenant-a", "PHOTOGRAPHER"), AuthResponse.class);
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Bob", "bob@b.com", TEST_PASSWORD, "tenant-b", "PHOTOGRAPHER"), AuthResponse.class);

        // Login as each
        ResponseEntity<AuthResponse> loginA = rest.postForEntity("/api/auth/login",
            new LoginRequest("alice@a.com", TEST_PASSWORD), AuthResponse.class);
        ResponseEntity<AuthResponse> loginB = rest.postForEntity("/api/auth/login",
            new LoginRequest("bob@b.com", TEST_PASSWORD), AuthResponse.class);

        String tokenA = extractCookie(loginA, "access_token");
        String tokenB = extractCookie(loginB, "access_token");
        assertThat(tokenA).isNotBlank();
        assertThat(tokenB).isNotBlank();

        // Token A → /me returns only Tenant A data
        MeResponse meA = rest.exchange(
            "/api/auth/me", HttpMethod.GET, new HttpEntity<>(bearerHeaders(tokenA)), MeResponse.class
        ).getBody();
        assertThat(meA.tenant().subdomain()).isEqualTo("tenant-a");
        assertThat(meA.email()).isEqualTo("alice@a.com");

        // Token B → /me returns only Tenant B data
        MeResponse meB = rest.exchange(
            "/api/auth/me", HttpMethod.GET, new HttpEntity<>(bearerHeaders(tokenB)), MeResponse.class
        ).getBody();
        assertThat(meB.tenant().subdomain()).isEqualTo("tenant-b");
        assertThat(meB.email()).isEqualTo("bob@b.com");

        // User IDs are distinct
        assertThat(meA.id()).isNotEqualTo(meB.id());
    }

    @Test
    void invalidTokenReturns401() {
        ResponseEntity<String> resp = rest.exchange(
            "/api/auth/me", HttpMethod.GET,
            new HttpEntity<>(bearerHeaders("invalid.jwt.token")),
            String.class
        );
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private HttpHeaders bearerHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        return h;
    }
}
