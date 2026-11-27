package com.photographplatform.api.messaging;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.contract.dto.CreateContractRequest;
import com.photographplatform.api.contract.service.ContractService;
import com.photographplatform.api.messaging.application.ContractToSignMessage;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.service.EmailSender;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Contract to sign, from the photographer's click to the Customer's inbox: a
 * real {@link ContractService} send or resend on Postgres, the outbox row it
 * leaves, and that row rendered by the real renderer and handed to the
 * transport.
 */
class ContractToSignMessageIT extends IntegrationTestBase {

    private static final String CUSTOMER = "emma+portal@example.test";
    private static final String ROW = "SELECT %s FROM outbox_jobs WHERE tenant_id = ?";

    @Autowired private ContractService contractService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private PlatformTransactionManager txManager;

    @MockitoBean private EmailSender sender;

    @BeforeEach
    void setUp() {
        reset(sender);
        when(sender.providerName()).thenReturn("test");
    }

    @Test
    void sendingTellsAGermanCustomerInTheStudiosName() {
        Fixture fx = studio(CustomerLanguage.DE);

        as(fx, () -> contractService.send(fx.contractId(), null, null));

        assertThat(row(fx, "recipient_email")).isEqualTo(CUSTOMER);
        assertThat(row(fx, "payload->>'fromName'")).isEqualTo("Studio Lichtblick");
        assertThat(row(fx, "payload->>'replyTo'")).isEqualTo("hallo@lichtblick.test");
        assertThat(row(fx, "payload->>'template'")).isEqualTo(ContractToSignMessage.TEMPLATE);
        assertThat(row(fx, "payload->'params'->>'language'")).isEqualTo("DE");
        assertThat(row(fx, "payload->'params'->>'contractUrl'")).isEqualTo(link(fx));
        assertThat(row(fx, "idempotency_key")).startsWith("CONTRACT_TO_SIGN:" + fx.contractId() + ":");

        EmailMessage mail = deliver();
        assertThat(mail.to()).isEqualTo(CUSTOMER);
        assertThat(mail.type()).isEqualTo(EmailType.CONTRACT_TO_SIGN);
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Ihr Vertrag von Studio Lichtblick zur Unterschrift");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Guten Tag Emma Clarke,")
            .contains("<strong>Studio Lichtblick</strong> hat Ihnen einen Vertrag gesendet.")
            .contains("Vertrag ansehen und unterschreiben")
            .contains(link(fx).replace("&", "&amp;") + "\"")
            .contains("Versendet über Fotolio");
    }

    @Test
    void sendingTellsAnEnglishCustomerInEnglish() {
        Fixture fx = studio(CustomerLanguage.EN);

        as(fx, () -> contractService.send(fx.contractId(), null, null));

        assertThat(row(fx, "recipient_email")).isEqualTo(CUSTOMER);
        assertThat(row(fx, "payload->>'fromName'")).isEqualTo("Studio Lichtblick");
        assertThat(row(fx, "payload->>'replyTo'")).isEqualTo("hallo@lichtblick.test");
        assertThat(row(fx, "payload->'params'->>'language'")).isEqualTo("EN");
        assertThat(row(fx, "payload->'params'->>'contractUrl'")).isEqualTo(link(fx));

        EmailMessage mail = deliver();
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Your contract from Studio Lichtblick to sign");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Hello Emma Clarke,")
            .contains("<strong>Studio Lichtblick</strong> has sent you a contract.")
            .contains("View and sign contract")
            .contains(link(fx).replace("&", "&amp;") + "\"")
            .contains("Sent via Fotolio");
    }

    @Test
    void resendingTellsTheCustomerAgainInTheirLanguage() {
        Fixture fx = studio(CustomerLanguage.EN);
        as(fx, () -> contractService.send(fx.contractId(), null, null));
        executeAcrossTenants("DELETE FROM outbox_jobs WHERE tenant_id = ?", fx.tenantId());

        as(fx, () -> contractService.resend(fx.contractId(), null, null));

        assertThat(row(fx, "recipient_email")).isEqualTo(CUSTOMER);
        assertThat(row(fx, "payload->>'fromName'")).isEqualTo("Studio Lichtblick");
        assertThat(row(fx, "payload->>'replyTo'")).isEqualTo("hallo@lichtblick.test");
        assertThat(row(fx, "payload->'params'->>'language'")).isEqualTo("EN");
        assertThat(row(fx, "payload->'params'->>'contractUrl'")).isEqualTo(link(fx));

        EmailMessage mail = deliver();
        assertThat(mail.subject()).isEqualTo("Your contract from Studio Lichtblick to sign");
        assertThat(mail.htmlBody()).contains("<html lang=\"en\"").contains(link(fx).replace("&", "&amp;"));
    }

    @Test
    void resendingInGermanIsWrittenInGerman() {
        Fixture fx = studio(CustomerLanguage.DE);
        as(fx, () -> contractService.send(fx.contractId(), null, null));
        executeAcrossTenants("DELETE FROM outbox_jobs WHERE tenant_id = ?", fx.tenantId());

        as(fx, () -> contractService.resend(fx.contractId(), null, null));

        assertThat(row(fx, "payload->'params'->>'language'")).isEqualTo("DE");
        EmailMessage mail = deliver();
        assertThat(mail.to()).isEqualTo(CUSTOMER);
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Ihr Vertrag von Studio Lichtblick zur Unterschrift");
        assertThat(mail.htmlBody()).contains("<html lang=\"de\"").contains(link(fx).replace("&", "&amp;"));
    }

    /** Each click is one message: two resends are two rows, and the contract stays as it was. */
    @Test
    void twoResendsQueueTwoMessagesAndLeaveTheContractSent() {
        Fixture fx = studio(CustomerLanguage.DE);
        as(fx, () -> contractService.send(fx.contractId(), null, null));
        var sentAt = as(fx, () -> contractService.get(fx.contractId())).sentAt();

        as(fx, () -> contractService.resend(fx.contractId(), null, null));
        as(fx, () -> contractService.resend(fx.contractId(), null, null));

        assertThat(countAcrossTenants(
            "SELECT count(*) FROM outbox_jobs WHERE tenant_id = ? AND idempotency_key LIKE 'CONTRACT_TO_SIGN:%'",
            fx.tenantId())).isEqualTo(3);
        assertThat(valueAcrossTenants("SELECT status FROM contracts WHERE id = ?", fx.contractId()))
            .isEqualTo("SENT");
        assertThat(as(fx, () -> contractService.get(fx.contractId())).sentAt()).isEqualTo(sentAt);
    }

    @Test
    void resendingADraftIsAConflict() {
        Fixture fx = studio(CustomerLanguage.DE);

        assertThatThrownBy(() -> as(fx, () -> contractService.resend(fx.contractId(), null, null)))
            .isInstanceOf(ConflictException.class);
        assertThat(countAcrossTenants("SELECT count(*) FROM outbox_jobs WHERE tenant_id = ?", fx.tenantId()))
            .isZero();
    }

    @Test
    void resendingASignedContractIsAConflict() {
        Fixture fx = studio(CustomerLanguage.DE);
        as(fx, () -> contractService.send(fx.contractId(), null, null));
        executeAcrossTenants("""
            UPDATE contracts SET status = 'SIGNED', signed_at = now(), signer_name = 'Emma Clarke',
                   body_sha256 = repeat('a', 64) WHERE id = ?""", fx.contractId());
        executeAcrossTenants("DELETE FROM outbox_jobs WHERE tenant_id = ?", fx.tenantId());

        assertThatThrownBy(() -> as(fx, () -> contractService.resend(fx.contractId(), null, null)))
            .isInstanceOf(ConflictException.class);
        assertThat(countAcrossTenants("SELECT count(*) FROM outbox_jobs WHERE tenant_id = ?", fx.tenantId()))
            .isZero();
    }

    /** Sending twice used to answer 500 from the entity's IllegalStateException. */
    @Test
    void sendingAContractThatWasAlreadySentIsAConflict() {
        Fixture fx = studio(CustomerLanguage.DE);
        as(fx, () -> contractService.send(fx.contractId(), null, null));

        assertThatThrownBy(() -> as(fx, () -> contractService.send(fx.contractId(), null, null)))
            .isInstanceOf(ConflictException.class);
    }

    /**
     * The note is the photographer's plain text: markup in it shows as text and
     * cannot pass for part of the email, a link least of all.
     */
    @Test
    void aPersonalNoteWithHtmlIsEscaped() {
        Fixture fx = studio(CustomerLanguage.DE);
        String note = "Bis Freitag bitte!\n<a href=\"https://evil.test\">Jetzt bezahlen</a>";

        as(fx, () -> contractService.send(fx.contractId(), note, null));

        assertThat(deliver().htmlBody())
            .contains("Bis Freitag bitte!<br>&lt;a href=&quot;https://evil.test&quot;&gt;Jetzt bezahlen&lt;/a&gt;")
            .doesNotContain("<a href=\"https://evil.test\"");
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    private record Fixture(UUID tenantId, UUID userId, String subdomain, UUID contractId) {
    }

    private Fixture studio(CustomerLanguage language) {
        String subdomain = "contract-" + UUID.randomUUID().toString().substring(0, 8);
        TransactionTemplate tx = new TransactionTemplate(txManager);
        Tenant tenant = tx.execute(status -> {
            Tenant t = new Tenant(subdomain, "owner-" + subdomain + "@example.test");
            t.setPlan(Plan.PRO);
            t.setBusinessName("Studio Lichtblick");
            t.setLegalName("Anna Müller");
            t.setLegalEmail("hallo@lichtblick.test");
            return tenantRepository.save(t);
        });
        UUID tenantId = tenant.getId();
        TenantContext.setTenant(tenantId.toString());
        try {
            UUID userId = tx.execute(status -> userRepository.save(
                new User(tenantId, "photographer-" + subdomain + "@example.test", "hash", "Anna")).getId());
            UUID bookingId = tx.execute(status -> {
                Booking booking = new Booking("Emma Clarke", CUSTOMER, LocalDate.now().plusDays(30));
                booking.setTenantId(tenantId);
                booking.setLanguage(language);
                return bookingRepository.save(booking).getId();
            });
            Fixture withoutContract = new Fixture(tenantId, userId, subdomain, null);
            UUID contractId = as(withoutContract, () -> contractService.createForBooking(
                bookingId, new CreateContractRequest(null, null), null)).id();
            return new Fixture(tenantId, userId, subdomain, contractId);
        } finally {
            TenantContext.clear();
        }
    }

    private static String link(Fixture fx) {
        return "http://localhost:3000/customer/auth/login?subdomain=" + fx.subdomain()
            + "&email=emma%2Bportal%40example.test&next=%2Fdocuments%3Fid%3D" + fx.contractId();
    }

    private String row(Fixture fx, String column) {
        return valueAcrossTenants(ROW.formatted(column), fx.tenantId());
    }

    private <T> T as(Fixture fx, Supplier<T> action) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(fx.userId().toString(), null, List.of()));
        TenantContext.setTenant(fx.tenantId().toString());
        try {
            return action.get();
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    /** Drains the queue and returns the one email sent to the Customer. */
    private EmailMessage deliver() {
        deliverQueuedEmail();
        ArgumentCaptor<EmailMessage> sent = ArgumentCaptor.forClass(EmailMessage.class);
        verify(sender, atLeastOnce()).send(sent.capture());
        return sent.getAllValues().stream()
            .filter(m -> CUSTOMER.equals(m.to()))
            .reduce((a, b) -> {
                throw new AssertionError("more than one email to the Customer");
            })
            .orElseThrow(() -> new AssertionError("no email to the Customer"));
    }
}
