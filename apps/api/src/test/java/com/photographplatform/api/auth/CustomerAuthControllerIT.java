package com.photographplatform.api.auth;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.CustomerMagicLinkRequest;
import com.photographplatform.api.auth.dto.CustomerMagicLinkVerifyRequest;
import com.photographplatform.api.auth.dto.MeResponse;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.service.EmailService;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;

class CustomerAuthControllerIT extends IntegrationTestBase {

    // Test-only credential — not a real secret. pragma: allowlist secret
    private static final String TEST_PASSWORD = "Password1234";
    private static final Pattern TOKEN_FROM_LINK = Pattern.compile("token=([A-Za-z0-9_-]+)");

    @Autowired
    private TestRestTemplate rest;

    @MockitoSpyBean
    private EmailService emailService;

    @BeforeEach
    void setup() {
        mockRedisNoLock();
        reset(emailService);
    }

    @Test
    void requestThenVerifyIssuesCustomerSession() {
        registerPhotographer("anna@test.com", "anna-foto");

        // Step 1 — request magic link
        ResponseEntity<Void> reqResp = rest.postForEntity(
            "/api/auth/customer/magic-link/request",
            new CustomerMagicLinkRequest("maria@example.com", "anna-foto", "Maria K."),
            Void.class
        );
        assertThat(reqResp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        String rawToken = extractMagicLinkToken();
        assertThat(rawToken).isNotBlank();

        // Step 2 — verify token, expect cookies + customer auth response
        ResponseEntity<AuthResponse> verifyResp = rest.postForEntity(
            "/api/auth/customer/magic-link/verify",
            new CustomerMagicLinkVerifyRequest(rawToken),
            AuthResponse.class
        );
        assertThat(verifyResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        AuthResponse body = verifyResp.getBody();
        assertThat(body).isNotNull();
        assertThat(body.email()).isEqualTo("maria@example.com");
        assertThat(body.role()).isEqualTo("CUSTOMER");
        assertThat(body.emailVerified()).isTrue();
        assertThat(body.tenant().subdomain()).isEqualTo("anna-foto");

        String accessToken = extractCookie(verifyResp, "access_token");
        String refreshToken = extractCookie(verifyResp, "refresh_token");
        assertThat(accessToken).isNotBlank();
        assertThat(refreshToken).isNotBlank();

        // /me works with the customer's access token
        ResponseEntity<MeResponse> meResp = rest.exchange(
            "/api/auth/me", HttpMethod.GET,
            new HttpEntity<>(bearerHeaders(accessToken)),
            MeResponse.class
        );
        assertThat(meResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(meResp.getBody().role()).isEqualTo("CUSTOMER");
    }

    @Test
    void usedTokenCannotBeReplayed() {
        registerPhotographer("bob@test.com", "bob-foto");
        rest.postForEntity("/api/auth/customer/magic-link/request",
            new CustomerMagicLinkRequest("alice@example.com", "bob-foto", null), Void.class);
        String token = extractMagicLinkToken();

        // First verify succeeds
        ResponseEntity<AuthResponse> first = rest.postForEntity(
            "/api/auth/customer/magic-link/verify",
            new CustomerMagicLinkVerifyRequest(token), AuthResponse.class);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);

        // Replay must fail
        ResponseEntity<String> replay = rest.postForEntity(
            "/api/auth/customer/magic-link/verify",
            new CustomerMagicLinkVerifyRequest(token), String.class);
        assertThat(replay.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void newRequestInvalidatesPreviousToken() {
        registerPhotographer("carol@test.com", "carol-foto");

        rest.postForEntity("/api/auth/customer/magic-link/request",
            new CustomerMagicLinkRequest("dave@example.com", "carol-foto", null), Void.class);
        String firstToken = extractMagicLinkToken();
        reset(emailService);

        rest.postForEntity("/api/auth/customer/magic-link/request",
            new CustomerMagicLinkRequest("dave@example.com", "carol-foto", null), Void.class);
        String secondToken = extractMagicLinkToken();
        assertThat(secondToken).isNotEqualTo(firstToken);

        // Old token must no longer work
        ResponseEntity<String> oldResp = rest.postForEntity(
            "/api/auth/customer/magic-link/verify",
            new CustomerMagicLinkVerifyRequest(firstToken), String.class);
        assertThat(oldResp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        // New token works
        ResponseEntity<AuthResponse> newResp = rest.postForEntity(
            "/api/auth/customer/magic-link/verify",
            new CustomerMagicLinkVerifyRequest(secondToken), AuthResponse.class);
        assertThat(newResp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void invalidTokenReturns401() {
        ResponseEntity<String> resp = rest.postForEntity(
            "/api/auth/customer/magic-link/verify",
            new CustomerMagicLinkVerifyRequest("not-a-real-token"), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unknownSubdomainResponds204WithoutSendingEmail() {
        // Account-existence oracle protection: response is the same as the
        // happy path, but no email is sent.
        ResponseEntity<Void> resp = rest.postForEntity(
            "/api/auth/customer/magic-link/request",
            new CustomerMagicLinkRequest("ghost@example.com", "no-such-photographer", null),
            Void.class
        );
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(emailService, org.mockito.Mockito.never()).send(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void photographerCannotLoginThroughCustomerFlow() {
        registerPhotographer("eve@test.com", "eve-foto");
        // Photographer's own email on their own subdomain — must NOT issue a magic link.
        rest.postForEntity("/api/auth/customer/magic-link/request",
            new CustomerMagicLinkRequest("eve@test.com", "eve-foto", null), Void.class);
        verify(emailService, org.mockito.Mockito.never()).send(org.mockito.ArgumentMatchers.any());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void registerPhotographer(String email, String subdomain) {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Owner", email, TEST_PASSWORD, subdomain, "PHOTOGRAPHER", "STARTER"),
            AuthResponse.class);
        // Photographer registration also triggers a verification email — flush so
        // extractMagicLinkToken() picks up only the magic-link mail.
        reset(emailService);
    }

    private String extractMagicLinkToken() {
        ArgumentCaptor<EmailMessage> captor = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailService, atLeastOnce()).send(captor.capture());
        for (EmailMessage msg : captor.getAllValues()) {
            Matcher m = TOKEN_FROM_LINK.matcher(msg.htmlBody());
            if (m.find() && msg.htmlBody().contains("/customer/auth/verify")) {
                return m.group(1);
            }
        }
        throw new AssertionError("No magic-link email captured");
    }

    private HttpHeaders bearerHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        return h;
    }
}
