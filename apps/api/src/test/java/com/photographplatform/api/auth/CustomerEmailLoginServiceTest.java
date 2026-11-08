package com.photographplatform.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.LoginCode;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.LoginCodeRepository;
import com.photographplatform.api.auth.repository.RefreshTokenRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.auth.service.AvatarUrlResolver;
import com.photographplatform.api.auth.service.CustomerAuthService;
import com.photographplatform.api.booking.service.BookingQueryService;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.common.security.RateLimiter;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.service.EmailService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Sign-in by email alone: the client names no studio, and the studios that know
 * the address are found for them.
 *
 * <p>What must not go wrong: a code may only ever open the studio it was issued
 * for, a staff address must never receive a customer code, an address nobody
 * knows must look the same from outside as one everybody knows, and several
 * studios must not multiply an attacker's guesses.
 */
@ExtendWith(MockitoExtension.class)
class CustomerEmailLoginServiceTest {

    private static final String EMAIL = "maria@example.com";
    private static final String IP = "203.0.113.9";
    private static final Pattern CODE = Pattern.compile("letter-spacing:8px;[^>]*>(\\d{6})<");

    @Mock private TenantRepository tenantRepository;
    @Mock private UserRepository userRepository;
    @Mock private LoginCodeRepository tokenRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private JwtService jwtService;
    @Mock private EmailService emailService;
    @Mock private RateLimiter rateLimiter;
    @Mock private AuditService auditService;
    @Mock private AvatarUrlResolver avatarUrlResolver;
    @Mock private BookingQueryService bookingQueryService;

    private CustomerAuthService service;
    private Tenant studioA;
    private Tenant studioB;
    private User clientOfA;
    /** Codes saved per user, newest last — what the repository would hold. */
    private final Map<UUID, LoginCode> liveCodes = new HashMap<>();

    @BeforeEach
    void setUp() {
        service = new CustomerAuthService(
            tenantRepository, userRepository, tokenRepository, refreshTokenRepository,
            jwtService, emailService, rateLimiter, Clock.systemUTC(), auditService,
            avatarUrlResolver, bookingQueryService, 3_600_000L);

        studioA = tenant("studio-a", "Studio Alpha");
        studioB = tenant("studio-b", "Studio Beta");
        clientOfA = customer(studioA);

        lenient().when(tenantRepository.findById(studioA.getId())).thenReturn(Optional.of(studioA));
        lenient().when(tenantRepository.findById(studioB.getId())).thenReturn(Optional.of(studioB));
        lenient().when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            if (u.getId() == null) {
                setId(u, UUID.randomUUID());
            }
            return u;
        });
        lenient().when(tokenRepository.save(any(LoginCode.class))).thenAnswer(inv -> {
            LoginCode code = inv.getArgument(0);
            liveCodes.put(code.getUserId(), code);
            return code;
        });
        lenient().when(tokenRepository.findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(any()))
            .thenAnswer(inv -> Optional.ofNullable(liveCodes.get((UUID) inv.getArgument(0)))
                .filter(c -> !c.isUsed()));
        lenient().when(jwtService.generateToken(any(), any(), anyString())).thenReturn("jwt");
    }

    // ── requesting ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("one studio: one code, in the subject like the subdomain flow")
    void oneStudioGetsOneCode() {
        when(userRepository.findCustomersByEmail(EMAIL)).thenReturn(List.of(clientOfA));
        when(bookingQueryService.tenantsWithClientEmail(EMAIL)).thenReturn(List.of(studioA.getId()));

        service.requestLoginCodeByEmail(EMAIL, null, IP);

        EmailMessage mail = sentMail();
        assertThat(mail.to()).isEqualTo(EMAIL);
        assertThat(mail.subject()).matches("Your sign-in code: \\d{6}");
        assertThat(mail.htmlBody()).contains("Studio Alpha");
        assertThat(codesIn(mail)).hasSize(1);
    }

    /**
     * A studio that has booked the client but never seen them sign in is the
     * case this exists for — the first visit. The account is created then, as
     * the subdomain flow does on a first request.
     */
    @Test
    @DisplayName("a studio that only booked the client gets an account and its own code")
    void bookedOnlyStudioIsFoundAndGetsItsOwnCode() {
        when(userRepository.findCustomersByEmail(EMAIL)).thenReturn(List.of(clientOfA));
        when(bookingQueryService.tenantsWithClientEmail(EMAIL))
            .thenReturn(List.of(studioA.getId(), studioB.getId()));
        when(userRepository.findByTenantIdAndEmail(studioB.getId(), EMAIL)).thenReturn(Optional.empty());

        service.requestLoginCodeByEmail(EMAIL, "Maria Klein", IP);

        EmailMessage mail = sentMail();
        assertThat(mail.subject()).isEqualTo("Your sign-in codes");
        assertThat(mail.htmlBody()).contains("Studio Alpha").contains("Studio Beta");
        List<String> codes = codesIn(mail);
        assertThat(codes).hasSize(2).doesNotHaveDuplicates();
        ArgumentCaptor<User> created = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(created.capture());
        assertThat(created.getValue().getTenantId()).isEqualTo(studioB.getId());
        assertThat(created.getValue().getRole()).isEqualTo("CUSTOMER");
    }

    /** Staff sign in with a password; a customer code for their address would be a way round it. */
    @Test
    @DisplayName("a studio where the address belongs to staff sends no code")
    void staffAddressIsNeverGivenACustomerCode() {
        when(userRepository.findCustomersByEmail(EMAIL)).thenReturn(List.of());
        when(bookingQueryService.tenantsWithClientEmail(EMAIL)).thenReturn(List.of(studioB.getId()));
        User staff = new User(studioB.getId(), EMAIL, "hash", "Photographer");
        staff.setRole("PHOTOGRAPHER");
        when(userRepository.findByTenantIdAndEmail(studioB.getId(), EMAIL)).thenReturn(Optional.of(staff));

        service.requestLoginCodeByEmail(EMAIL, null, IP);

        verify(tokenRepository, never()).save(any(LoginCode.class));
        assertThat(sentMail().subject()).isEqualTo("Signing in to Fotolio");
    }

    /**
     * Nobody knows the address: the page answers exactly as it does for a known
     * one, and only the mailbox learns that no studio has it.
     */
    @Test
    @DisplayName("an unknown address gets a notice by email and no code")
    void unknownAddressGetsANoticeAndNoCode() {
        when(userRepository.findCustomersByEmail(EMAIL)).thenReturn(List.of());
        when(bookingQueryService.tenantsWithClientEmail(EMAIL)).thenReturn(List.of());

        service.requestLoginCodeByEmail(EMAIL, null, IP);

        verify(tokenRepository, never()).save(any(LoginCode.class));
        EmailMessage mail = sentMail();
        assertThat(mail.subject()).isEqualTo("Signing in to Fotolio");
        assertThat(codesIn(mail)).isEmpty();
    }

    /** Naming no studio must not be a way round the per-mailbox ceiling. */
    @Test
    @DisplayName("the request is rate-limited per address, under its own key")
    void rateLimitedPerAddress() {
        when(userRepository.findCustomersByEmail(EMAIL)).thenReturn(List.of());
        when(bookingQueryService.tenantsWithClientEmail(EMAIL)).thenReturn(List.of());

        service.requestLoginCodeByEmail(EMAIL, null, IP);

        verify(rateLimiter).check(eq("login:req:email:any:" + EMAIL), anyInt(), any(), anyString());
        verify(rateLimiter).check(startsWith("login:req:ip:"), anyInt(), any(), anyString());
    }

    // ── verifying ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("the code typed back opens the studio it was issued for")
    void codeOpensItsOwnStudio() {
        User clientOfB = customer(studioB);
        when(userRepository.findCustomersByEmail(EMAIL)).thenReturn(List.of(clientOfA, clientOfB));
        when(bookingQueryService.tenantsWithClientEmail(EMAIL)).thenReturn(List.of());
        service.requestLoginCodeByEmail(EMAIL, null, IP);
        String codeForB = codeFor(sentMail(), "Studio Beta");

        var result = service.verifyLoginCodeByEmail(EMAIL, codeForB, IP);

        assertThat(result.response().tenant().subdomain()).isEqualTo("studio-b");
        assertThat(liveCodes.get(clientOfB.getId()).isUsed()).isTrue();
    }

    /** Three studios must not buy an attacker three times the guesses. */
    @Test
    @DisplayName("a wrong code counts against every studio's code at once")
    void wrongCodeCountsAgainstEveryStudio() {
        User clientOfB = customer(studioB);
        when(userRepository.findCustomersByEmail(EMAIL)).thenReturn(List.of(clientOfA, clientOfB));
        when(bookingQueryService.tenantsWithClientEmail(EMAIL)).thenReturn(List.of());
        service.requestLoginCodeByEmail(EMAIL, null, IP);
        List<String> issued = codesIn(sentMail());
        String wrong = "000000";
        while (issued.contains(wrong)) {
            wrong = String.format("%06d", Integer.parseInt(wrong) + 1);
        }
        final String guess = String.format("%06d", Integer.parseInt(wrong));

        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> service.verifyLoginCodeByEmail(EMAIL, guess, IP))
                .isInstanceOf(UnauthorizedException.class);
        }

        assertThat(liveCodes.get(clientOfA.getId()).isUsed()).isTrue();
        assertThat(liveCodes.get(clientOfB.getId()).isUsed()).isTrue();
        // Burnt, so even the right code no longer opens anything.
        assertThatThrownBy(() -> service.verifyLoginCodeByEmail(EMAIL, issued.get(0), IP))
            .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    @DisplayName("an address with no code in flight is refused like any wrong code")
    void noCodeInFlightIsRefused() {
        when(userRepository.findCustomersByEmail(EMAIL)).thenReturn(List.of(clientOfA));

        assertThatThrownBy(() -> service.verifyLoginCodeByEmail(EMAIL, "123456", IP))
            .isInstanceOf(UnauthorizedException.class)
            .hasMessage("That code isn't valid. Request a new one.");
        verify(jwtService, never()).generateToken(any(), any(), anyString());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private EmailMessage sentMail() {
        ArgumentCaptor<EmailMessage> mail = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailService, times(1)).send(mail.capture());
        return mail.getValue();
    }

    private static List<String> codesIn(EmailMessage mail) {
        List<String> codes = new ArrayList<>();
        Matcher m = CODE.matcher(mail.htmlBody());
        while (m.find()) {
            codes.add(m.group(1));
        }
        return codes;
    }

    /** The code printed after a studio's name. */
    private static String codeFor(EmailMessage mail, String studio) {
        String body = mail.htmlBody();
        Matcher m = CODE.matcher(body.substring(body.indexOf(studio)));
        assertThat(m.find()).as("a code under " + studio).isTrue();
        return m.group(1);
    }

    private static Tenant tenant(String subdomain, String legalName) {
        Tenant t = new Tenant(subdomain, "owner@" + subdomain + ".de");
        setId(t, UUID.randomUUID());
        try {
            var field = Tenant.class.getDeclaredField("legalName");
            field.setAccessible(true);
            field.set(t, legalName);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
        return t;
    }

    private static User customer(Tenant tenant) {
        User u = new User(tenant.getId(), EMAIL, null, "Maria Klein");
        u.setRole("CUSTOMER");
        setId(u, UUID.randomUUID());
        return u;
    }

    private static void setId(Object entity, UUID id) {
        try {
            var field = entity.getClass().getDeclaredField("id");
            field.setAccessible(true);
            field.set(entity, id);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
