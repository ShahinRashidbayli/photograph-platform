package com.photographplatform.api.auth;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.CustomerLoginCodeVerifyRequest;
import com.photographplatform.api.auth.dto.CustomerMagicLinkRequest;
import com.photographplatform.api.auth.dto.MeResponse;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

/**
 * End-to-end customer sign-in over the six-digit code flow that replaced the
 * magic link. See {@code CustomerAuthService} for why the link lost sign-ins
 * even though it worked, and {@code CustomerLoginCodeServiceTest} for the unit
 * coverage of the guessing bounds.
 */
class CustomerAuthControllerIT extends IntegrationTestBase {

    // Test-only credential — not a real secret. pragma: allowlist secret
    private static final String TEST_PASSWORD = "Password1234";
    private static final Pattern CODE_IN_SUBJECT = Pattern.compile("(\\d{6})");

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

        // Step 1 — request a login code
        ResponseEntity<Void> reqResp = rest.postForEntity(
            "/api/auth/customer/login-code/request",
            new CustomerMagicLinkRequest("maria@example.com", "anna-foto", "Maria K."),
            Void.class
        );
        assertThat(reqResp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        String code = extractLoginCode();
        assertThat(code).matches("\\d{6}");

        // Step 2 — type the code back in; expect cookies + customer auth response
        ResponseEntity<AuthResponse> verifyResp = rest.postForEntity(
            "/api/auth/customer/login-code/verify",
            new CustomerLoginCodeVerifyRequest("maria@example.com", "anna-foto", code),
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
    void usedCodeCannotBeReplayed() {
        registerPhotographer("bob@test.com", "bob-foto");
        rest.postForEntity("/api/auth/customer/login-code/request",
            new CustomerMagicLinkRequest("alice@example.com", "bob-foto", null), Void.class);
        String code = extractLoginCode();

        ResponseEntity<AuthResponse> first = rest.postForEntity(
            "/api/auth/customer/login-code/verify",
            new CustomerLoginCodeVerifyRequest("alice@example.com", "bob-foto", code),
            AuthResponse.class);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<String> replay = rest.postForEntity(
            "/api/auth/customer/login-code/verify",
            new CustomerLoginCodeVerifyRequest("alice@example.com", "bob-foto", code),
            String.class);
        assertThat(replay.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void newRequestInvalidatesPreviousCode() {
        registerPhotographer("carol@test.com", "carol-foto");

        rest.postForEntity("/api/auth/customer/login-code/request",
            new CustomerMagicLinkRequest("dave@example.com", "carol-foto", null), Void.class);
        String firstCode = extractLoginCode();
        reset(emailService);

        rest.postForEntity("/api/auth/customer/login-code/request",
            new CustomerMagicLinkRequest("dave@example.com", "carol-foto", null), Void.class);
        String secondCode = extractLoginCode();

        // Resending must not leave two live codes — that would double an
        // attacker's odds every time an impatient customer pressed the button.
        ResponseEntity<String> oldResp = rest.postForEntity(
            "/api/auth/customer/login-code/verify",
            new CustomerLoginCodeVerifyRequest("dave@example.com", "carol-foto", firstCode),
            String.class);
        assertThat(oldResp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        ResponseEntity<AuthResponse> newResp = rest.postForEntity(
            "/api/auth/customer/login-code/verify",
            new CustomerLoginCodeVerifyRequest("dave@example.com", "carol-foto", secondCode),
            AuthResponse.class);
        assertThat(newResp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void wrongCodeReturns401() {
        registerPhotographer("frank@test.com", "frank-foto");
        rest.postForEntity("/api/auth/customer/login-code/request",
            new CustomerMagicLinkRequest("guest@example.com", "frank-foto", null), Void.class);
        String code = extractLoginCode();

        ResponseEntity<String> resp = rest.postForEntity(
            "/api/auth/customer/login-code/verify",
            new CustomerLoginCodeVerifyRequest("guest@example.com", "frank-foto",
                "000000".equals(code) ? "111111" : "000000"),
            String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void malformedCodeIsRejectedAtTheEdge() {
        // Bean validation rejects it before the service can count it as a failed
        // attempt, so junk input cannot burn a real customer's code for them.
        //
        // 422, not 400: GlobalExceptionHandler answers every
        // MethodArgumentNotValidException with UNPROCESSABLE_ENTITY and
        // code=VALIDATION_FAILED, uniformly across the API. The endpoint was
        // never the odd one out here — this expectation was.
        ResponseEntity<String> resp = rest.postForEntity(
            "/api/auth/customer/login-code/verify",
            new CustomerLoginCodeVerifyRequest("someone@example.com", "anna-foto", "abc"),
            String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(resp.getBody()).contains("VALIDATION_FAILED");
    }

    @Test
    void unknownSubdomainResponds204WithoutSendingEmail() {
        // Account-existence oracle protection: response is the same as the
        // happy path, but no email is sent.
        ResponseEntity<Void> resp = rest.postForEntity(
            "/api/auth/customer/login-code/request",
            new CustomerMagicLinkRequest("ghost@example.com", "no-such-photographer", null),
            Void.class
        );
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        // send() is @Async: checked at once, a mail queued but not yet started
        // would pass as "never sent". Wait for it to have had the chance.
        verify(emailService, after(1_000).never()).send(any());
    }

    @Test
    void photographerCannotLoginThroughCustomerFlow() {
        registerPhotographer("eve@test.com", "eve-foto");
        // Photographer's own email on their own subdomain — must NOT issue a code,
        // or passwordless login becomes a way around password auth.
        rest.postForEntity("/api/auth/customer/login-code/request",
            new CustomerMagicLinkRequest("eve@test.com", "eve-foto", null), Void.class);
        // Only sign-in mails count: Eve's own verification mail from
        // registration is @Async too and may land after the reset.
        verify(emailService, after(1_000).never())
            .send(argThat(m -> m != null && m.type() == EmailType.LOGIN_CODE));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void registerPhotographer(String email, String subdomain) {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Owner", email, TEST_PASSWORD, subdomain, "PHOTOGRAPHER", "STARTER"),
            AuthResponse.class);
        // Photographer registration also triggers a verification email — flush so
        // extractLoginCode() picks up only the login-code mail.
        reset(emailService);
    }

    private String extractLoginCode() {
        // send() is @Async, so the call can reach the spy after the response;
        // wait for the sign-in mail rather than verifying at once.
        verify(emailService, timeout(5_000).atLeastOnce())
            .send(argThat(m -> m != null && m.type() == EmailType.LOGIN_CODE));
        ArgumentCaptor<EmailMessage> captor = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailService, atLeastOnce()).send(captor.capture());
        for (EmailMessage msg : captor.getAllValues()) {
            if (!msg.subject().startsWith("Your sign-in code")) {
                continue;
            }
            Matcher m = CODE_IN_SUBJECT.matcher(msg.subject());
            if (m.find()) {
                return m.group(1);
            }
        }
        throw new AssertionError("No login-code email captured");
    }

    private HttpHeaders bearerHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        return h;
    }
}
