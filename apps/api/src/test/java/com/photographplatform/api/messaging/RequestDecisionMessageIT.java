package com.photographplatform.api.messaging;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.inquiry.event.InquiryDecidedEvent;
import com.photographplatform.api.messaging.application.RequestDecisionMessage;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.service.EmailSender;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Instant;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Request decision through the module's interface: an {@link InquiryDecidedEvent}
 * published inside a transaction on a real Postgres, the outbox row it leaves,
 * and that row rendered by the real renderer and handed to the transport.
 */
class RequestDecisionMessageIT extends IntegrationTestBase {

    private static final String CUSTOMER = "emma+portal@example.test";

    @Autowired private ApplicationEventPublisher events;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private PlatformTransactionManager txManager;

    @MockitoBean private EmailSender sender;

    @BeforeEach
    void setUp() {
        reset(sender);
        when(sender.providerName()).thenReturn("test");
    }

    @Test
    void anAcceptedGermanRequestLinksToTheBookingThroughTheCustomerSignIn() {
        Tenant studio = studio(t -> { });
        UUID bookingId = UUID.randomUUID();

        publishDecision(studio, CustomerLanguage.DE, true, bookingId, null);

        assertThat(valueAcrossTenants("SELECT recipient_email FROM outbox_jobs WHERE tenant_id = ?",
            studio.getId())).isEqualTo(CUSTOMER);
        assertThat(valueAcrossTenants("SELECT payload::text FROM outbox_jobs WHERE tenant_id = ?",
            studio.getId())).contains(RequestDecisionMessage.TEMPLATE).doesNotContain("<");

        EmailMessage mail = deliver();
        assertThat(mail.to()).isEqualTo(CUSTOMER);
        assertThat(mail.type()).isEqualTo(EmailType.CUSTOMER_REQUEST_DECISION);
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Ihre Anfrage bei Studio Lichtblick wurde angenommen");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Guten Tag Emma Clarke,")
            .contains("<strong>Studio Lichtblick</strong> hat Ihre Anfrage angenommen")
            .contains("Buchung ansehen")
            .contains("/customer/auth/login?subdomain=" + studio.getSubdomain()
                + "&amp;email=emma%2Bportal%40example.test"
                + "&amp;next=%2Fbookings%3Fid%3D" + bookingId + "\"")
            .contains("Versendet über Fotolio");
    }

    @Test
    void anAcceptedEnglishRequestIsWrittenInEnglish() {
        Tenant studio = studio(t -> { });

        publishDecision(studio, CustomerLanguage.EN, true, UUID.randomUUID(), null);

        EmailMessage mail = deliver();
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Your request to Studio Lichtblick was accepted");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Hello Emma Clarke,")
            .contains("<strong>Studio Lichtblick</strong> has accepted your request")
            .contains("View booking")
            .contains("/customer/auth/login?subdomain=")
            .contains("Sent via Fotolio");
    }

    @Test
    void aDeclinedGermanRequestIsShortPoliteAndHasNoLink() {
        Tenant studio = studio(t -> { });

        publishDecision(studio, CustomerLanguage.DE, false, null, null);

        EmailMessage mail = deliver();
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Ihre Anfrage bei Studio Lichtblick");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Leider kann <strong>Studio Lichtblick</strong> Ihre Anfrage dieses Mal nicht annehmen.")
            .contains("Wir wünschen Ihnen alles Gute.")
            .doesNotContain("<a ")
            .doesNotContain("/customer/auth/login");
    }

    @Test
    void aDeclinedEnglishRequestIsWrittenInEnglish() {
        Tenant studio = studio(t -> { });

        publishDecision(studio, CustomerLanguage.EN, false, null, null);

        EmailMessage mail = deliver();
        assertThat(mail.to()).isEqualTo(CUSTOMER);
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Your request to Studio Lichtblick");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Unfortunately <strong>Studio Lichtblick</strong> is unable to accept your request")
            .contains("We wish you all the best.")
            .doesNotContain("<a ");
    }

    /** White-label: the studio's colour and copy, and no mention of Fotolio anywhere. */
    @Test
    void onWhiteLabelTheStudiosColourShowsAndFotolioIsNotMentioned() {
        Tenant studio = studio(t -> {
            t.setPlan(Plan.STUDIO);
            t.setBrandColor("#AA3355");
        });

        publishDecision(studio, CustomerLanguage.DE, true, UUID.randomUUID(), null);

        EmailMessage mail = deliver();
        assertThat(mail.to()).isEqualTo(CUSTOMER);
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Ihre Anfrage bei Studio Lichtblick wurde angenommen");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("<strong>Studio Lichtblick</strong> hat Ihre Anfrage angenommen")
            .contains("Buchung ansehen")
            .contains("#AA3355")
            .doesNotContain("Fotolio");
    }

    @Test
    void onWhiteLabelAnEnglishDeclineIsInTheStudiosNameOnly() {
        Tenant studio = studio(t -> {
            t.setPlan(Plan.STUDIO);
            t.setBrandColor("#AA3355");
        });

        publishDecision(studio, CustomerLanguage.EN, false, null, null);

        EmailMessage mail = deliver();
        assertThat(mail.to()).isEqualTo(CUSTOMER);
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Your request to Studio Lichtblick");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Unfortunately <strong>Studio Lichtblick</strong> is unable to accept your request")
            .contains("We wish you all the best.")
            .doesNotContain("<a ")
            .doesNotContain("Fotolio");
    }

    @Test
    void withoutABusinessNameOrLegalEmailItFallsBackToLegalNameAndOwner() {
        Tenant studio = studio(t -> {
            t.setBusinessName(null);
            t.setLegalEmail(null);
            t.setLegalName("Anna Müller");
        });

        publishDecision(studio, CustomerLanguage.EN, false, null, null);

        EmailMessage mail = deliver();
        assertThat(mail.fromName()).isEqualTo("Anna Müller");
        assertThat(mail.replyTo()).isEqualTo(studio.getOwnerEmail());
        assertThat(mail.subject()).isEqualTo("Your request to Anna Müller");
    }

    /**
     * The note is the photographer's plain text: markup in it shows as text and
     * cannot pass for part of the email, a link least of all.
     */
    @Test
    void aPersonalNoteWithHtmlIsEscaped() {
        Tenant studio = studio(t -> { });
        String note = "Wir freuen uns!\n<a href=\"https://evil.test\">Jetzt bezahlen</a>";

        publishDecision(studio, CustomerLanguage.DE, false, null, note);

        assertThat(deliver().htmlBody())
            .contains("Wir freuen uns!<br>&lt;a href=&quot;https://evil.test&quot;&gt;Jetzt bezahlen&lt;/a&gt;")
            .doesNotContain("<a href=\"https://evil.test\"");
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    private Tenant studio(Consumer<Tenant> customise) {
        String subdomain = "decision-" + UUID.randomUUID().toString().substring(0, 8);
        return new TransactionTemplate(txManager).execute(status -> {
            Tenant tenant = new Tenant(subdomain, "owner-" + subdomain + "@example.test");
            tenant.setBusinessName("Studio Lichtblick");
            tenant.setLegalEmail("hallo@lichtblick.test");
            customise.accept(tenant);
            return tenantRepository.save(tenant);
        });
    }

    private void publishDecision(Tenant tenant, CustomerLanguage language, boolean accepted, UUID bookingId,
                                 String note) {
        InquiryDecidedEvent event = new InquiryDecidedEvent(this, UUID.randomUUID(), tenant.getId(), CUSTOMER,
            "Emma Clarke", language, accepted, bookingId, note, Instant.now());
        TenantContext.setTenant(tenant.getId().toString());
        try {
            new TransactionTemplate(txManager).executeWithoutResult(status -> events.publishEvent(event));
        } finally {
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
