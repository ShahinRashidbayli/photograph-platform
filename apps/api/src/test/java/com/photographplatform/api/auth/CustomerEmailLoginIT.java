package com.photographplatform.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.CustomerLoginCodeVerifyRequest;
import com.photographplatform.api.auth.dto.CustomerMagicLinkRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.service.EmailService;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * Sign-in by email alone, against a real Postgres with RLS switched on.
 *
 * <p>The application connects as {@code fotolio_app}, so every booking query is
 * confined to one studio. The case that matters most — a client the studio has
 * booked but who has never signed in — can only be found through {@code
 * customer_login_tenants} (V38). These tests prove it finds them without
 * opening anything else up.
 */
class CustomerEmailLoginIT extends IntegrationTestBase {

    // Test-only credential — not a real secret. pragma: allowlist secret
    private static final String TEST_PASSWORD = "Password1234";
    private static final Pattern CODE = Pattern.compile("letter-spacing:8px;[^>]*>(\\d{6})<");

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private DataSource dataSource;

    @MockitoSpyBean
    private EmailService emailService;

    @BeforeEach
    void setup() {
        mockRedisNoLock();
        reset(emailService);
    }

    @Test
    void aClientTheStudioOnlyBookedSignsInWithTheirEmail() {
        UUID studio = registerPhotographer("anna@test.com", "anna-foto");
        book(studio, "maria@example.com");

        assertThat(request("maria@example.com").getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        List<String> codes = codesSentTo("maria@example.com");
        assertThat(codes).hasSize(1);

        ResponseEntity<AuthResponse> session = signIn("maria@example.com", codes.get(0));
        assertThat(session.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(session.getBody().tenant().subdomain()).isEqualTo("anna-foto");
        assertThat(session.getBody().role()).isEqualTo("CUSTOMER");
    }

    @Test
    void aClientOfTwoStudiosGetsACodeForEachAndEachOpensItsOwn() {
        UUID anna = registerPhotographer("anna@test.com", "anna-foto");
        UUID bob = registerPhotographer("bob@test.com", "bob-foto");
        book(anna, "maria@example.com");
        book(bob, "maria@example.com");

        request("maria@example.com");
        String body = lastMailTo("maria@example.com").htmlBody();
        String codeForBob = codeAfter(body, "bob-foto");

        ResponseEntity<AuthResponse> session = signIn("maria@example.com", codeForBob);
        assertThat(session.getBody().tenant().subdomain()).isEqualTo("bob-foto");
    }

    /** Booked somewhere else entirely: a third studio must not appear. */
    @Test
    void studiosThatNeverBookedTheClientAreNotIncluded() {
        UUID anna = registerPhotographer("anna@test.com", "anna-foto");
        UUID carol = registerPhotographer("carol@test.com", "carol-foto");
        book(anna, "maria@example.com");
        book(carol, "someone-else@example.com");

        request("maria@example.com");

        String body = lastMailTo("maria@example.com").htmlBody();
        assertThat(codesIn(body)).hasSize(1);
        assertThat(body).doesNotContain("carol-foto");
    }

    @Test
    void anUnknownAddressIsAnsweredTheSameAndGetsNoCode() {
        registerPhotographer("anna@test.com", "anna-foto");

        assertThat(request("nobody@example.com").getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        EmailMessage mail = lastMailTo("nobody@example.com");
        assertThat(mail.subject()).isEqualTo("Signing in to Fotolio");
        assertThat(codesIn(mail.htmlBody())).isEmpty();
    }

    /**
     * The lookup binds each studio in turn; it must hand the caller its own
     * binding back, or whatever runs next in the transaction would act inside
     * the last studio it looked at.
     */
    @Test
    void theLookupLeavesTheCallersTenantBindingAsItFoundIt() throws Exception {
        UUID anna = registerPhotographer("anna@test.com", "anna-foto");
        UUID bob = registerPhotographer("bob@test.com", "bob-foto");
        book(anna, "maria@example.com");
        book(bob, "maria@example.com");

        try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement()) {
            conn.setAutoCommit(false);
            st.execute("SELECT set_config('app.tenant_id', '" + anna + "', true)");

            List<UUID> found = new ArrayList<>();
            try (ResultSet rs = st.executeQuery(
                    "SELECT * FROM customer_login_tenants('MARIA@example.com')")) {
                while (rs.next()) {
                    found.add(rs.getObject(1, UUID.class));
                }
            }
            try (ResultSet rs = st.executeQuery("SELECT current_setting('app.tenant_id', true)")) {
                rs.next();
                assertThat(rs.getString(1)).isEqualTo(anna.toString());
            }
            // And the application role still sees only the bound studio's bookings.
            try (ResultSet rs = st.executeQuery("SELECT count(DISTINCT tenant_id) FROM bookings")) {
                rs.next();
                assertThat(rs.getInt(1)).isEqualTo(1);
            }
            conn.rollback();

            assertThat(found).containsExactlyInAnyOrder(anna, bob);
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private ResponseEntity<Void> request(String email) {
        return rest.postForEntity("/api/auth/customer/login-code/request",
            // An English sign-in page: the email follows its language.
            new CustomerMagicLinkRequest(email, null, null, "en"), Void.class);
    }

    private ResponseEntity<AuthResponse> signIn(String email, String code) {
        return rest.postForEntity("/api/auth/customer/login-code/verify",
            new CustomerLoginCodeVerifyRequest(email, null, code), AuthResponse.class);
    }

    private UUID registerPhotographer(String email, String subdomain) {
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Owner", email, TEST_PASSWORD, subdomain, "PHOTOGRAPHER", "STARTER", null),
            AuthResponse.class);
        // Registration queues a verification email; start each test's capture
        // clean. It can still land after this reset (EmailService#send is
        // @Async), which is why lastMailTo picks by recipient and type.
        reset(emailService);
        // The tenant id, read from outside the isolation boundary.
        return UUID.fromString(valueAcrossTenants("SELECT id FROM tenants WHERE subdomain = ?", subdomain));
    }

    private void book(UUID tenantId, String clientEmail) {
        executeAcrossTenants("""
            INSERT INTO bookings (tenant_id, client_name, client_email, event_date, status)
            VALUES (?, 'Maria Klein', ?, CURRENT_DATE + 30, 'CONFIRMED')
            """, tenantId, clientEmail);
    }

    /**
     * The last sign-in mail sent to {@code address}, after delivering the
     * queue. Picked by recipient and type because the studios' verification
     * mails from registration are queued too, and one of those was once
     * captured as the "last" mail, with no code in it.
     */
    private EmailMessage lastMailTo(String address) {
        deliverQueuedEmail();
        verify(emailService, atLeastOnce()).deliver(argThat(m -> isSignInMailTo(m, address)));
        ArgumentCaptor<EmailMessage> captor = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailService, atLeastOnce()).deliver(captor.capture());
        List<EmailMessage> signInMails = captor.getAllValues().stream()
            .filter(m -> isSignInMailTo(m, address))
            .toList();
        return signInMails.get(signInMails.size() - 1);
    }

    private static boolean isSignInMailTo(EmailMessage mail, String address) {
        return mail != null && mail.type() == EmailType.LOGIN_CODE && address.equals(mail.to());
    }

    private List<String> codesSentTo(String address) {
        return codesIn(lastMailTo(address).htmlBody());
    }

    private static List<String> codesIn(String html) {
        List<String> codes = new ArrayList<>();
        Matcher m = CODE.matcher(html);
        while (m.find()) {
            codes.add(m.group(1));
        }
        return codes;
    }

    /** With no legal name on file, a studio is named by its subdomain. */
    private static String codeAfter(String html, String studio) {
        Matcher m = CODE.matcher(html.substring(html.indexOf(studio)));
        assertThat(m.find()).as("a code under " + studio).isTrue();
        return m.group(1);
    }
}
