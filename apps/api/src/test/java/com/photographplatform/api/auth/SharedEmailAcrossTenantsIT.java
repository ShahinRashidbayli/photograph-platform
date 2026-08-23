package com.photographplatform.api.auth;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.CustomerMagicLinkRequest;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * One address, several accounts — the situation the product creates on its own.
 *
 * <h2>The bug this pins down</h2>
 * {@code CustomerAuthService} creates a customer per tenant, so a person who
 * hires two photographers here ends up with two {@code users} rows sharing an
 * email. Nothing was wrong with that. What was wrong was
 * {@code UserRepository.findByEmail(String)} returning an {@code Optional} —
 * asserting one row per address platform-wide — which four flows relied on.
 *
 * <p>The moment a second row appeared, that query threw
 * {@code IncorrectResultSizeDataAccessException} and photographer login,
 * password reset, the public portfolio page and gallery watermarking all
 * answered 500. Permanently, with no fix available from inside the product.
 * If the duplicated address happened to be a photographer's own, their whole
 * public presence went dark.
 *
 * <p>{@code V23__staff_email_uniqueness.sql} now states the rule the code was
 * only assuming — staff addresses unique globally, customer addresses unique
 * per tenant — and the queries were split to match. These tests drive the real
 * flows rather than inserting rows, because the point is that ordinary use
 * produced the collision.
 *
 * @see com.photographplatform.api.auth.repository.UserRepository
 */
class SharedEmailAcrossTenantsIT extends IntegrationTestBase {

    // Test-only credential — not a real secret. pragma: allowlist secret
    private static final String TEST_PASSWORD = "Password1234";
    private static final String SHARED_CLIENT = "shared-client@example.test";

    @Autowired
    private TestRestTemplate rest;

    @BeforeEach
    void setup() {
        mockRedisNoLock();
    }

    /**
     * The exact scenario: one client, two photographers. Both photographers
     * must still be able to sign in afterwards.
     */
    @Test
    void aClientOfTwoPhotographersDoesNotBreakEitherPhotographersLogin() {
        registerPhotographer("anna@example.test", "anna-foto");
        registerPhotographer("bruno@example.test", "bruno-foto");

        requestMagicLink(SHARED_CLIENT, "anna-foto");
        requestMagicLink(SHARED_CLIENT, "bruno-foto");

        // Without this the test proves nothing: if the flow quietly reused one
        // row, the collision it is supposed to reproduce never happened.
        assertThat(countUsersWithEmail(SHARED_CLIENT))
            .as("the client should hold one account per photographer they hired")
            .isEqualTo(2);

        assertThat(login("anna@example.test").getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(login("bruno@example.test").getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    /**
     * The worst version of the failure. A photographer who is also another
     * photographer's client duplicates their <em>own</em> address, and the
     * public page — which looks the owner up by that address — went down with
     * it. Anonymous, cached by nothing, visible to every prospective customer.
     */
    @Test
    void aPhotographerWhoIsAlsoAnotherPhotographersClientKeepsTheirPublicPage() {
        registerPhotographer("anna@example.test", "anna-foto");
        registerPhotographer("bruno@example.test", "bruno-foto");

        // Anna hires Bruno. Her address now exists twice: staff row in her own
        // tenant, customer row in his.
        requestMagicLink("anna@example.test", "bruno-foto");

        ResponseEntity<String> page =
            rest.getForEntity("/api/public/portfolio/anna-foto", String.class);

        assertThat(page.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(login("anna@example.test").getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    /**
     * The flip side of scoping the registration check to staff. Someone who
     * arrived as a client and now wants their own studio is the likeliest
     * signup there is — the old global {@code existsByEmail} turned them away
     * with "email already in use" and no way forward.
     */
    @Test
    void anExistingClientCanRegisterAsAPhotographer() {
        registerPhotographer("anna@example.test", "anna-foto");
        requestMagicLink(SHARED_CLIENT, "anna-foto");

        ResponseEntity<String> registration = rest.postForEntity("/api/auth/register",
            new RegisterRequest("Shared Client", SHARED_CLIENT, TEST_PASSWORD,
                "shared-studio", "PHOTOGRAPHER", "STARTER"),
            String.class);

        assertThat(registration.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(login(SHARED_CLIENT).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    /** Staff uniqueness is still enforced — that half of the rule must hold. */
    @Test
    void twoPhotographersStillCannotShareAnAddress() {
        registerPhotographer("anna@example.test", "anna-foto");

        ResponseEntity<String> second = rest.postForEntity("/api/auth/register",
            new RegisterRequest("Impostor", "anna@example.test", TEST_PASSWORD,
                "other-studio", "PHOTOGRAPHER", "STARTER"),
            String.class);

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private void registerPhotographer(String email, String subdomain) {
        ResponseEntity<AuthResponse> resp = rest.postForEntity("/api/auth/register",
            new RegisterRequest("Owner", email, TEST_PASSWORD, subdomain,
                "PHOTOGRAPHER", "STARTER"),
            AuthResponse.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    /** Just-in-time customer signup — this is what mints the extra row. */
    private void requestMagicLink(String email, String subdomain) {
        ResponseEntity<Void> resp = rest.postForEntity(
            "/api/auth/customer/magic-link/request",
            new CustomerMagicLinkRequest(email, subdomain, "Client"),
            Void.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    private ResponseEntity<AuthResponse> login(String email) {
        return rest.postForEntity("/api/auth/login",
            new LoginRequest(email, TEST_PASSWORD), AuthResponse.class);
    }

    private long countUsersWithEmail(String email) {
        return countAcrossTenants("SELECT count(*) FROM users WHERE email = ?", email);
    }
}
