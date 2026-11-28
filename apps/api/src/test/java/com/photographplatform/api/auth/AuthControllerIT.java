package com.photographplatform.api.auth;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.MeResponse;
import com.photographplatform.api.auth.dto.RefreshRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.auth.dto.SubdomainAvailabilityResponse;
import com.photographplatform.api.auth.dto.UpdateProfileRequest;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

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
            "Anna Foto", "anna@test.com", TEST_PASSWORD, "anna-foto", "PHOTOGRAPHER", "STARTER", null);
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
        // A JWT minted in the same second as the login token carries identical
        // claims (iat/exp are second-resolution) and is therefore byte-equal —
        // asserting inequality here is a timing race. Presence is the invariant.
        assertThat(newAccess).isNotBlank();
    }

    @Test
    void theUiLanguageIsStoredAndFollowsEverySwitch() {
        // Sign-up from an English page: the verification email goes out at
        // once, so the language is stored with the account.
        ResponseEntity<AuthResponse> regResp = rest.postForEntity("/api/auth/register",
            new RegisterRequest("Lena", "lena@test.com", TEST_PASSWORD, "lena-foto", "PHOTOGRAPHER", null, "en"),
            AuthResponse.class);
        assertThat(regResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(regResp.getBody().language()).isEqualTo("en");
        String accessToken = extractCookie(regResp, "access_token");

        ResponseEntity<MeResponse> switched = rest.exchange("/api/auth/me", HttpMethod.PATCH,
            new HttpEntity<>(new UpdateProfileRequest(null, null, null, "de"), writeHeaders(accessToken)),
            MeResponse.class);
        assertThat(switched.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(switched.getBody().language()).isEqualTo("de");

        ResponseEntity<MeResponse> me = rest.exchange("/api/auth/me", HttpMethod.GET,
            new HttpEntity<>(bearerHeaders(accessToken)), MeResponse.class);
        assertThat(me.getBody().language()).isEqualTo("de");
        assertThat(me.getBody().fullName()).isEqualTo("Lena");
    }

    @Test
    void aSignUpWithoutALanguageIsGermanAndAnUnknownOneIsRefused() {
        ResponseEntity<AuthResponse> regResp = rest.postForEntity("/api/auth/register",
            new RegisterRequest("Jan", "jan@test.com", TEST_PASSWORD, "jan-foto", "PHOTOGRAPHER", null, null),
            AuthResponse.class);
        assertThat(regResp.getBody().language()).isEqualTo("de");

        ResponseEntity<String> refused = rest.exchange("/api/auth/me", HttpMethod.PATCH,
            new HttpEntity<>(new UpdateProfileRequest(null, null, null, "fr"),
                writeHeaders(extractCookie(regResp, "access_token"))),
            String.class);
        assertThat(refused.getStatusCode().is4xxClientError()).isTrue();
    }

    @Test
    void logoutInvalidatesRefreshToken() {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Bob", "bob@test.com", TEST_PASSWORD, "bob-foto", "PHOTOGRAPHER", "STARTER", null),
            AuthResponse.class);
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
                "my-studio", "PHOTOGRAPHER", "STARTER", null), AuthResponse.class);

        ResponseEntity<String> resp = rest.postForEntity("/api/auth/register",
            new RegisterRequest("User Two", "two@test.com", TEST_PASSWORD,
                "my-studio", "PHOTOGRAPHER", "STARTER", null), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void duplicateEmailReturns409() {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Eve One", "eve@test.com", TEST_PASSWORD,
                "eve-one", "PHOTOGRAPHER", "STARTER", null), AuthResponse.class);

        ResponseEntity<String> resp = rest.postForEntity("/api/auth/register",
            new RegisterRequest("Eve Two", "eve@test.com", TEST_PASSWORD,
                "eve-two", "PHOTOGRAPHER", "STARTER", null), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    /**
     * 422, matching what bean validation already answered for a malformed
     * subdomain. A reserved name and a syntactically invalid one are the same
     * rejection to a caller; which layer caught it is our business, not theirs.
     * The {@code code} still separates them ({@code INVALID_REQUEST} here,
     * {@code VALIDATION_FAILED} from the annotation).
     */
    @Test
    void reservedSubdomainIsRejectedAsUnprocessable() {
        ResponseEntity<String> resp = rest.postForEntity("/api/auth/register",
            new RegisterRequest("Sneaky", "sneaky@test.com", TEST_PASSWORD,
                "admin", "PHOTOGRAPHER", "STARTER", null), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
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
                "carol-foto", "PHOTOGRAPHER", "STARTER", null), AuthResponse.class);

        ResponseEntity<String> resp = rest.postForEntity("/api/auth/login",
            new LoginRequest("carol@test.com", "wrongpassword"), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ── Lockout ──────────────────────────────────────────────────────────────

    /**
     * A locked-out sign-in is answered as a lockout, not as bad credentials.
     *
     * <p>The password used here is the <em>correct</em> one: that is the case
     * that used to be indistinguishable from a typo, leaving a user who had
     * simply mistyped five times convinced the product had lost their account.
     */
    @Test
    void lockedOutLoginIsAnsweredAsRateLimitedWithTheRemainingWait() {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Lock Ed", "locked@test.com", TEST_PASSWORD,
                "locked-foto", "PHOTOGRAPHER", "STARTER", null), AuthResponse.class);

        lockEmail("locked@test.com", 300L);

        ResponseEntity<Map<String, Object>> resp = rest.exchange(
            "/api/auth/login", HttpMethod.POST,
            new HttpEntity<>(new LoginRequest("locked@test.com", TEST_PASSWORD)),
            new ParameterizedTypeReference<Map<String, Object>>() {});

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(resp.getBody()).containsEntry("code", "TOO_MANY_REQUESTS");
        assertThat(resp.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("300");

        @SuppressWarnings("unchecked")
        Map<String, Object> details = (Map<String, Object>) resp.getBody().get("details");
        assertThat(details).containsEntry("retryAfterSeconds", 300);

        // The message is the one thing a user reads; it must say "wait", not
        // "wrong password".
        assertThat((String) resp.getBody().get("error")).containsIgnoringCase("too many");
    }

    /**
     * The lock is a fact about attempts, not about accounts: an address that
     * was never registered locks identically, so the 429 cannot be used to
     * decide whether an account exists.
     */
    @Test
    void lockoutDoesNotRevealWhetherTheAccountExists() {
        lockEmail("ghost@test.com", 300L);

        ResponseEntity<String> resp = rest.postForEntity("/api/auth/login",
            new LoginRequest("ghost@test.com", TEST_PASSWORD), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    /**
     * A lock whose TTL Redis will not report still locks. Reporting zero would
     * invite an immediate retry that is refused again, so the full lockout
     * window is answered instead.
     */
    @Test
    void lockWithUnreadableTtlReportsTheFullWindow() {
        lockEmail("nottl@test.com", null);

        ResponseEntity<String> resp = rest.postForEntity("/api/auth/login",
            new LoginRequest("nottl@test.com", TEST_PASSWORD), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(resp.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("900");
    }

    // ── Subdomain availability ───────────────────────────────────────────────

    /**
     * The sign-up form asks this while the user is typing, so the answer has to
     * agree with what {@code register} would do with the same value — a "free"
     * here followed by a 409 there would be worse than not asking at all.
     */
    @Test
    void subdomainAvailabilityAgreesWithRegistration() {
        ResponseEntity<SubdomainAvailabilityResponse> free = rest.getForEntity(
            "/api/auth/subdomain-available?subdomain=anna-foto",
            SubdomainAvailabilityResponse.class);
        assertThat(free.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(free.getBody().available()).isTrue();
        assertThat(free.getBody().reason()).isNull();

        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Anna Foto", "avail@test.com", TEST_PASSWORD,
                "anna-foto", "PHOTOGRAPHER", "STARTER", null), AuthResponse.class);

        ResponseEntity<SubdomainAvailabilityResponse> taken = rest.getForEntity(
            "/api/auth/subdomain-available?subdomain=anna-foto",
            SubdomainAvailabilityResponse.class);
        assertThat(taken.getBody().available()).isFalse();
        assertThat(taken.getBody().reason()).isEqualTo("TAKEN");
    }

    /** Reserved and malformed are different problems and deserve different advice. */
    @Test
    void subdomainAvailabilityDistinguishesReservedFromMalformed() {
        assertThat(rest.getForEntity(
            "/api/auth/subdomain-available?subdomain=admin",
            SubdomainAvailabilityResponse.class).getBody().reason()).isEqualTo("RESERVED");

        assertThat(rest.getForEntity(
            "/api/auth/subdomain-available?subdomain=ab",
            SubdomainAvailabilityResponse.class).getBody().reason()).isEqualTo("INVALID");

        assertThat(rest.getForEntity(
            "/api/auth/subdomain-available?subdomain=-nope-",
            SubdomainAvailabilityResponse.class).getBody().reason()).isEqualTo("INVALID");
    }

    /**
     * The echo lets a debounced caller throw away an answer it has typed past,
     * and it is normalized, so the check and the registration agree on case.
     */
    @Test
    void subdomainAvailabilityEchoesTheNormalizedValueItChecked() {
        ResponseEntity<SubdomainAvailabilityResponse> resp = rest.getForEntity(
            "/api/auth/subdomain-available?subdomain=Anna-Foto",
            SubdomainAvailabilityResponse.class);

        assertThat(resp.getBody().subdomain()).isEqualTo("anna-foto");
    }

    /** Unauthenticated by design — the caller has no account yet. */
    @Test
    void subdomainAvailabilityNeedsNoSession() {
        assertThat(rest.getForEntity(
            "/api/auth/subdomain-available?subdomain=somebody-new",
            SubdomainAvailabilityResponse.class).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    /**
     * Reading the TTL is a second round trip, so Redis can disappear between
     * the existence check and it. The lock still stands; answering 500 would
     * replace a message that says when to come back with one that says
     * nothing.
     */
    @Test
    void lockSurvivesRedisFailingOnTheTtlRead() {
        String lockKey = "login:lock:email:flaky@test.com";
        when(redisTemplate.hasKey(lockKey)).thenReturn(true);
        when(redisTemplate.getExpire(lockKey, TimeUnit.SECONDS))
            .thenThrow(new org.springframework.dao.QueryTimeoutException("redis gone"));

        ResponseEntity<String> resp = rest.postForEntity("/api/auth/login",
            new LoginRequest("flaky@test.com", TEST_PASSWORD), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(resp.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("900");
    }

    /** Marks an address as locked out, with the TTL Redis would report. */
    private void lockEmail(String email, Long remainingSeconds) {
        String lockKey = "login:lock:email:" + email;
        when(redisTemplate.hasKey(lockKey)).thenReturn(true);
        when(redisTemplate.getExpire(lockKey, TimeUnit.SECONDS)).thenReturn(remainingSeconds);
    }

    /** A write needs the CSRF double-submit pair as well as the token. */
    private HttpHeaders writeHeaders(String token) {
        HttpHeaders h = bearerHeaders(token);
        h.add(HttpHeaders.COOKIE, "XSRF-TOKEN=test-csrf-token");
        h.add("X-XSRF-TOKEN", "test-csrf-token");
        return h;
    }

    private HttpHeaders bearerHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        return h;
    }
}
