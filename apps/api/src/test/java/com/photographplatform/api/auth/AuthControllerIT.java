package com.photographplatform.api.auth;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.MeResponse;
import com.photographplatform.api.auth.dto.RefreshRequest;
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

class AuthControllerIT extends IntegrationTestBase {

    // Test-only credential — not a real secret. pragma: allowlist secret
    private static final String TEST_PASSWORD = "Password1234";

    @Autowired
    private TestRestTemplate rest;

    @BeforeEach
    void setup() {
        mockRedisNoLock();
    }

    @Test
    void registerLoginMeRefreshFlow() {
        // Register
        RegisterRequest reg = new RegisterRequest(
            "Anna Foto", "anna@test.com", TEST_PASSWORD, "anna-foto", "PHOTOGRAPHER");
        ResponseEntity<AuthResponse> regResp = rest.postForEntity("/api/auth/register", reg, AuthResponse.class);
        assertThat(regResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(regResp.getBody()).isNotNull();
        assertThat(regResp.getBody().tenant().subdomain()).isEqualTo("anna-foto");
        assertThat(regResp.getBody().role()).isEqualTo("PHOTOGRAPHER");
        assertThat(extractCookie(regResp, "access_token")).isNotBlank();
        assertThat(extractCookie(regResp, "refresh_token")).isNotBlank();

        // Login
        LoginRequest login = new LoginRequest("anna@test.com", TEST_PASSWORD);
        ResponseEntity<AuthResponse> loginResp = rest.postForEntity("/api/auth/login", login, AuthResponse.class);
        assertThat(loginResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        String accessToken = extractCookie(loginResp, "access_token");
        String refreshToken = extractCookie(loginResp, "refresh_token");
        assertThat(accessToken).isNotBlank();
        assertThat(refreshToken).isNotBlank();

        // Me
        ResponseEntity<MeResponse> meResp = rest.exchange(
            "/api/auth/me", HttpMethod.GET, new HttpEntity<>(bearerHeaders(accessToken)), MeResponse.class
        );
        assertThat(meResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(meResp.getBody().email()).isEqualTo("anna@test.com");

        // Refresh (body-based — Postman / API client path)
        ResponseEntity<AuthResponse> refreshResp = rest.postForEntity(
            "/api/auth/refresh", new RefreshRequest(refreshToken), AuthResponse.class
        );
        assertThat(refreshResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        String newAccess = extractCookie(refreshResp, "access_token");
        assertThat(newAccess).isNotBlank().isNotEqualTo(accessToken);
    }

    @Test
    void logoutInvalidatesRefreshToken() {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Bob", "bob@test.com", TEST_PASSWORD, "bob-foto", "PHOTOGRAPHER"), AuthResponse.class);
        ResponseEntity<AuthResponse> loginResp = rest.postForEntity("/api/auth/login",
            new LoginRequest("bob@test.com", TEST_PASSWORD), AuthResponse.class);
        String accessToken = extractCookie(loginResp, "access_token");
        String refreshToken = extractCookie(loginResp, "refresh_token");

        ResponseEntity<Void> logoutResp = rest.exchange(
            "/api/auth/logout", HttpMethod.POST,
            new HttpEntity<>(bearerHeaders(accessToken)), Void.class
        );
        assertThat(logoutResp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<String> refreshResp = rest.postForEntity(
            "/api/auth/refresh", new RefreshRequest(refreshToken), String.class
        );
        assertThat(refreshResp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void logoutWithoutAuthIsIdempotent() {
        ResponseEntity<Void> resp = rest.exchange(
            "/api/auth/logout", HttpMethod.POST, HttpEntity.EMPTY, Void.class
        );
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void duplicateSubdomainReturns409() {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("User One", "one@test.com", TEST_PASSWORD,
                "my-studio", "PHOTOGRAPHER"), AuthResponse.class);

        ResponseEntity<String> resp = rest.postForEntity("/api/auth/register",
            new RegisterRequest("User Two", "two@test.com", TEST_PASSWORD,
                "my-studio", "PHOTOGRAPHER"), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void duplicateEmailReturns409() {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Eve One", "eve@test.com", TEST_PASSWORD,
                "eve-one", "PHOTOGRAPHER"), AuthResponse.class);

        ResponseEntity<String> resp = rest.postForEntity("/api/auth/register",
            new RegisterRequest("Eve Two", "eve@test.com", TEST_PASSWORD,
                "eve-two", "PHOTOGRAPHER"), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void reservedSubdomainReturns400() {
        ResponseEntity<String> resp = rest.postForEntity("/api/auth/register",
            new RegisterRequest("Sneaky", "sneaky@test.com", TEST_PASSWORD,
                "admin", "PHOTOGRAPHER"), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void noTokenReturns401() {
        assertThat(rest.getForEntity("/api/auth/me", String.class).getStatusCode())
            .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void wrongPasswordReturns401() {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Carol", "carol@test.com", TEST_PASSWORD,
                "carol-foto", "PHOTOGRAPHER"), AuthResponse.class);

        ResponseEntity<String> resp = rest.postForEntity("/api/auth/login",
            new LoginRequest("carol@test.com", "wrongpassword"), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private HttpHeaders bearerHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        return h;
    }
}
