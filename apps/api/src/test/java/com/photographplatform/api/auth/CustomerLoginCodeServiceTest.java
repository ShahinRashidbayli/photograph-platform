package com.photographplatform.api.auth;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.LoginCode;
import com.photographplatform.api.common.exception.TooManyRequestsException;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.LoginCodeRepository;
import com.photographplatform.api.auth.repository.RefreshTokenRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.auth.service.CustomerAuthService;
import com.photographplatform.api.booking.service.BookingQueryService;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.auth.service.AvatarUrlResolver;
import com.photographplatform.api.common.security.RateLimiter;
import java.time.Clock;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.util.TokenUtils;
import com.photographplatform.api.auth.service.SignInCodeEmail;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.service.EmailService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The rules the six-digit customer login code must not get wrong.
 *
 * <p>A code this short is only safe because guessing is bounded from several
 * directions at once. Each test here pins one of those bounds, so removing any
 * of them fails loudly rather than quietly turning a million-guess space into
 * something an attacker can walk.
 */
@ExtendWith(MockitoExtension.class)
class CustomerLoginCodeServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final String SUBDOMAIN = "anna-foto";
    private static final String EMAIL = "maria@example.com";
    private static final String IP = "203.0.113.9";

    @Mock private TenantRepository tenantRepository;
    @Mock private UserRepository userRepository;
    @Mock private LoginCodeRepository tokenRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private JwtService jwtService;
    @Mock private EmailService emailService;
    /** Stubbed to allow everything: no test here is about the rate limit. */
    @Mock private RateLimiter rateLimiter;
    @Mock private AuditService auditService;
    @Mock private AvatarUrlResolver avatarUrlResolver;
    @Mock private BookingQueryService bookingQueryService;

    private CustomerAuthService service;
    private Tenant tenant;
    private User customer;

    @BeforeEach
    void setUp() {
        service = new CustomerAuthService(
            tenantRepository, userRepository, tokenRepository, refreshTokenRepository,
            jwtService, emailService, rateLimiter, Clock.systemUTC(), auditService,
            avatarUrlResolver, bookingQueryService, 3_600_000L);

        tenant = new Tenant(SUBDOMAIN, "anna@studio.de");
        setId(tenant, TENANT_ID);

        customer = new User(TENANT_ID, EMAIL, null, "Maria Klein");
        customer.setRole("CUSTOMER");
        setId(customer, USER_ID);

        // Lenient only for the shared scaffolding: these describe "a working
        // world" that every test needs some subset of, and making each test
        // restate the half it happens to touch would bury the one line it is
        // actually about. Stubs written *inside* a test stay strict, which is
        // where an unused one would signal that the test has drifted from the
        // path it claims to exercise.
        lenient().when(tenantRepository.findBySubdomain(SUBDOMAIN))
            .thenReturn(Optional.of(tenant));
        lenient().when(userRepository.findByTenantIdAndEmail(TENANT_ID, EMAIL))
            .thenReturn(Optional.of(customer));
        lenient().when(userRepository.save(any(User.class)))
            .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(tokenRepository.save(any(LoginCode.class)))
            .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(jwtService.generateToken(any(), any(), anyString())).thenReturn("jwt");
    }

    // ── issuing ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("the emailed code is always exactly six digits, zero-padded")
    void codeIsSixDigits() {
        service.requestLoginCode(SUBDOMAIN, EMAIL, null, IP);

        // A code shorter than six digits would mean a small random value was
        // rendered without padding, shrinking the search space for everyone.
        assertThat(sentCode()).matches(Pattern.compile("^\\d{6}$"));
    }

    @Test
    @DisplayName("only the salted hash is stored — never the code itself")
    void storesSaltedHashNotCode() {
        service.requestLoginCode(SUBDOMAIN, EMAIL, null, IP);

        String code = sentCode();
        ArgumentCaptor<LoginCode> saved = ArgumentCaptor.forClass(LoginCode.class);
        verify(tokenRepository).save(saved.capture());

        assertThat(saved.getValue().getTokenHash()).isNotEqualTo(code);
        assertThat(saved.getValue().getTokenHash())
            .isEqualTo(TokenUtils.sha256(USER_ID + ":" + code));
        // The bare hash must not match, or the user-id salt is not doing its job
        // and one precomputed table would cover every user in the system.
        assertThat(saved.getValue().getTokenHash()).isNotEqualTo(TokenUtils.sha256(code));
    }

    @Test
    @DisplayName("issuing a code invalidates any earlier one")
    void issuingInvalidatesEarlierCodes() {
        service.requestLoginCode(SUBDOMAIN, EMAIL, null, IP);

        // Otherwise "Resend" would leave two live codes and double the odds for
        // an attacker each time an impatient customer pressed it.
        verify(tokenRepository).invalidateAllForUser(any(UUID.class), any(OffsetDateTime.class));
    }

    @Test
    @DisplayName("a photographer on their own subdomain gets no customer code")
    void photographerGetsNoCode() {
        customer.setRole("PHOTOGRAPHER");

        service.requestLoginCode(SUBDOMAIN, EMAIL, null, IP);

        // Passwordless login must never become a way around password auth.
        verify(emailService, never()).queue(any());
        verify(tokenRepository, never()).save(any(LoginCode.class));
    }

    // ── verifying ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("the emailed code signs the customer in")
    void correctCodeAuthenticates() {
        String code = issueCode();

        var result = service.verifyLoginCode(SUBDOMAIN, EMAIL, code, IP);

        assertThat(result.response().email()).isEqualTo(EMAIL);
        assertThat(result.accessToken()).isEqualTo("jwt");
    }

    @Test
    @DisplayName("receiving the code proves the mailbox, so it verifies the email")
    void correctCodeVerifiesEmail() {
        String code = issueCode();
        assertThat(customer.isEmailVerified()).isFalse();

        service.verifyLoginCode(SUBDOMAIN, EMAIL, code, IP);

        assertThat(customer.isEmailVerified()).isTrue();
    }

    @Test
    @DisplayName("a used code cannot be replayed")
    void codeIsSingleUse() {
        String code = issueCode();
        service.verifyLoginCode(SUBDOMAIN, EMAIL, code, IP);

        // After the first success the row is marked used, so the lookup that
        // filters on usedAt is null finds nothing.
        when(tokenRepository.findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(USER_ID))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.verifyLoginCode(SUBDOMAIN, EMAIL, code, IP))
            .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    @DisplayName("the code is destroyed after five wrong guesses")
    void codeBurnsAfterAttemptCap() {
        String code = issueCode();
        String wrong = wrongCodeFor(code);

        for (int i = 0; i < 5; i++) {
            final int attempt = i;
            assertThatThrownBy(() -> service.verifyLoginCode(SUBDOMAIN, EMAIL, wrong, IP))
                .as("guess %d should be rejected", attempt + 1)
                .isInstanceOf(UnauthorizedException.class);
        }

        // The whole point of the cap: after the budget is spent even the *right*
        // code is dead, so an attacker gets five tries per email sent rather
        // than unlimited tries against a million-value space.
        assertThatThrownBy(() -> service.verifyLoginCode(SUBDOMAIN, EMAIL, code, IP))
            .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    @DisplayName("a rejected guess must survive the rejection that reports it")
    void failedAttemptsAreNotRolledBack() throws NoSuchMethodException {
        // The test above passes against mocks whatever the transaction rules
        // are, because a mock repository hands back the same object and the
        // increment lives in memory. Under a real transaction manager it would
        // not: verifyLoginCode records the failed guess and *then* throws, and
        // the default rollback-on-RuntimeException would discard the increment
        // together with the exception that caused it. The counter would sit at
        // zero forever, the cap above would never fire, and a six-digit secret
        // would be left guessable at request speed — with nothing failing.
        //
        // So this asserts the persistence rule itself, which is the part no
        // mock-based test can observe.
        Transactional tx = CustomerAuthService.class
            .getMethod("verifyLoginCode", String.class, String.class, String.class, String.class)
            .getAnnotation(Transactional.class);

        assertThat(tx).as("verifyLoginCode must be transactional").isNotNull();
        assertThat(tx.noRollbackFor())
            .as("a rejected guess must be committed, not rolled back with the rejection")
            .contains(UnauthorizedException.class);
    }

    @Test
    @DisplayName("an expired code is rejected")
    void expiredCodeIsRejected() {
        String code = issueCode();
        // Re-point the lookup at a token that expired an hour ago.
        LoginCode expired = new LoginCode(
            USER_ID, TokenUtils.sha256(USER_ID + ":" + code),
            OffsetDateTime.now().minusHours(1));
        when(tokenRepository.findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(USER_ID))
            .thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> service.verifyLoginCode(SUBDOMAIN, EMAIL, code, IP))
            .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    @DisplayName("a code is worthless against a different photographer")
    void codeIsBoundToItsTenant() {
        // Deliberately not issueCode(): that also wires up the code lookup, and
        // the point here is that the request never gets that far. An unknown
        // subdomain resolves to no tenant, so verification stops before any
        // code is consulted — which is exactly the property under test.
        service.requestLoginCode(SUBDOMAIN, EMAIL, null, IP);
        String code = sentCode();

        // Codes are scoped per (tenant, email). Without this, one photographer's
        // customer could walk their code into another photographer's tenant.
        assertThatThrownBy(() -> service.verifyLoginCode("other-studio", EMAIL, code, IP))
            .isInstanceOf(UnauthorizedException.class);
        verify(tokenRepository, never())
            .findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(any(UUID.class));
    }

    @Test
    @DisplayName("every rejection reads the same, so nothing leaks about the mailbox")
    void rejectionsAreIndistinguishable() {
        String code = issueCode();

        String unknownEmail = messageOf(() ->
            service.verifyLoginCode(SUBDOMAIN, "nobody@example.com", code, IP));

        when(tokenRepository.findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(USER_ID))
            .thenReturn(Optional.of(new LoginCode(
                USER_ID, TokenUtils.sha256(USER_ID + ":" + code),
                OffsetDateTime.now().plusMinutes(10))));
        String wrongDigits = messageOf(() ->
            service.verifyLoginCode(SUBDOMAIN, EMAIL, wrongCodeFor(code), IP));

        // Differing messages would turn the endpoint into an oracle for which
        // addresses have a sign-in in flight.
        assertThat(unknownEmail).isEqualTo(wrongDigits);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /** Issues a real code and wires the lookup to return the token it created. */
    private String issueCode() {
        service.requestLoginCode(SUBDOMAIN, EMAIL, null, IP);
        ArgumentCaptor<LoginCode> saved = ArgumentCaptor.forClass(LoginCode.class);
        verify(tokenRepository).save(saved.capture());
        when(tokenRepository.findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(USER_ID))
            .thenReturn(Optional.of(saved.getValue()));
        return sentCode();
    }

    /** Reads the code out of the email that was actually sent. */
    private String sentCode() {
        ArgumentCaptor<OutgoingEmail> queued = ArgumentCaptor.forClass(OutgoingEmail.class);
        verify(emailService).queue(queued.capture());
        String subject = new SignInCodeEmail()
            .render((SignInCodeEmail.Params) queued.getValue().params()).subject();
        var matcher = Pattern.compile("(\\d{6})").matcher(subject);
        assertThat(matcher.find()).as("the email subject should carry the code").isTrue();
        return matcher.group(1);
    }

    private static String wrongCodeFor(String code) {
        return "000000".equals(code) ? "111111" : "000000";
    }

    private static String messageOf(Runnable action) {
        try {
            action.run();
            throw new AssertionError("expected the call to be rejected");
        } catch (UnauthorizedException ex) {
            return ex.getMessage();
        }
    }

    /** Ids are database-generated, so tests set them reflectively. */
    private static void setId(Object entity, UUID id) {
        try {
            var field = entity.getClass().getDeclaredField("id");
            field.setAccessible(true);
            field.set(entity, id);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }

    // ── the limit that survives a Redis outage ────────────────────────────────

    /**
     * Every request-side limit on this flow lives in Redis, and
     * {@code RateLimiter} fails open on purpose: a Redis outage should degrade
     * the product, not take login down with it. The cost of that choice is that
     * the same outage removes the 5-per-email-per-hour ceiling, and the only
     * thing left is the per-code cap of five wrong guesses — which an attacker
     * escapes simply by asking for another code. Unlimited rounds of five
     * guesses against a six-digit secret is not a rate limit.
     *
     * <p>So the per-email ceiling is counted in Postgres as well, from the codes
     * already issued to that user. The database is the one place that cannot be
     * unavailable while the flow still works: issuing a code writes a row there.
     *
     * <p>{@code rateLimiter} is a permissive mock here, which is exactly the
     * shape of a Redis outage — every check passes.
     */
    @Test
    @DisplayName("the per-email ceiling still applies when Redis is failing open")
    void tooManyCodesInAnHourIsRefusedWithoutRedis() {
        when(tokenRepository.countByUserIdAndCreatedAtAfter(eq(USER_ID), any()))
            .thenReturn(5L);

        assertThatThrownBy(() -> service.requestLoginCode(SUBDOMAIN, EMAIL, null, IP))
            .isInstanceOf(TooManyRequestsException.class);

        verify(tokenRepository, never()).save(any(LoginCode.class));
        verify(emailService, never()).queue(any());
    }

    /** Below the ceiling nothing changes — a guard that refuses everyone is not one. */
    @Test
    @DisplayName("an ordinary request is unaffected by the Postgres-side ceiling")
    void requestsBelowTheCeilingStillIssueACode() {
        when(tokenRepository.countByUserIdAndCreatedAtAfter(eq(USER_ID), any()))
            .thenReturn(4L);

        service.requestLoginCode(SUBDOMAIN, EMAIL, null, IP);

        verify(tokenRepository).save(any(LoginCode.class));
    }
}
