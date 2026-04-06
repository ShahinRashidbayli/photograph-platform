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
import org.springframework.test.context.jdbc.Sql;

import static org.assertj.core.api.Assertions.assertThat;

@Sql(scripts = "/db/cleanup.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
class AuthControllerIT extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate rest;

    @BeforeEach
    void setup() {
        mockRedisNoLock();
    }

    @Test
    void registerLoginMeRefreshFlow() {
        // Register
        RegisterRequest reg = new RegisterRequest("Anna Foto", "anna@test.com", "password123", "anna-foto");
        ResponseEntity<AuthResponse> regResp = rest.postForEntity("/api/auth/register", reg, AuthResponse.class);
        assertThat(regResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(regResp.getBody()).isNotNull();
        assertThat(regResp.getBody().tenant().subdomain()).isEqualTo("anna-foto");

        // Login
        LoginRequest login = new LoginRequest("anna@test.com", "password123");
        ResponseEntity<AuthResponse> loginResp = rest.postForEntity("/api/auth/login", login, AuthResponse.class);
        assertThat(loginResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        String accessToken = loginResp.getBody().accessToken();
        String refreshToken = loginResp.getBody().refreshToken();

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
        assertThat(refreshResp.getBody().accessToken()).isNotEqualTo(accessToken);
    }

    @Test
    void logoutInvalidatesRefreshToken() {
        // Register + login
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Bob", "bob@test.com", "password123", "bob-foto"), AuthResponse.class);
        AuthResponse login = rest.postForEntity("/api/auth/login",
            new LoginRequest("bob@test.com", "password123"), AuthResponse.class).getBody();

        // Logout
        ResponseEntity<Void> logoutResp = rest.exchange(
            "/api/auth/logout", HttpMethod.POST,
            new HttpEntity<>(bearerHeaders(login.accessToken())), Void.class
        );
        assertThat(logoutResp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // Refresh with old token must now fail
        ResponseEntity<String> refreshResp = rest.postForEntity(
            "/api/auth/refresh", new RefreshRequest(login.refreshToken()), String.class
        );
        assertThat(refreshResp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void duplicateSubdomainReturns409() {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("User One", "one@test.com", "password123", "my-studio"), AuthResponse.class);

        ResponseEntity<String> resp = rest.postForEntity("/api/auth/register",
            new RegisterRequest("User Two", "two@test.com", "password123", "my-studio"), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void noTokenReturns401() {
        assertThat(rest.getForEntity("/api/auth/me", String.class).getStatusCode())
            .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void wrongPasswordReturns401() {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Carol", "carol@test.com", "password123", "carol-foto"), AuthResponse.class);

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
