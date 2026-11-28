package com.photographplatform.api.messaging;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.messaging.application.EnquiryReceivedMessage;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.service.EmailSender;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

/**
 * Enquiry received through the module's interface: a {@link LeadCreatedEvent}
 * published inside a transaction on a real Postgres, the outbox row it leaves,
 * and that row rendered by the real renderer and handed to the transport.
 *
 * <p>The listener runs before commit, in the lead's transaction, with the
 * studio bound for RLS, as {@code LeadService} runs it; so the portfolio check
 * here sees only the studio's own photos.
 */
class EnquiryReceivedMessageIT extends IntegrationTestBase {

    private static final String CUSTOMER = "emma@example.test";

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
    void aGermanEnquiryIsAcknowledgedInGermanInTheStudiosName() {
        Tenant studio = studio(t -> { });
        publishPhotoFor(studio);

        publishLead(studio, LeadCreatedEvent.Origin.PUBLIC_FORM, CustomerLanguage.DE);

        assertThat(valueAcrossTenants("SELECT recipient_email FROM outbox_jobs WHERE tenant_id = ?",
            studio.getId())).isEqualTo(CUSTOMER);
        assertThat(valueAcrossTenants("SELECT payload::text FROM outbox_jobs WHERE tenant_id = ?",
            studio.getId())).contains(EnquiryReceivedMessage.TEMPLATE).doesNotContain("<");

        EmailMessage mail = deliver();
        assertThat(mail.to()).isEqualTo(CUSTOMER);
        assertThat(mail.type()).isEqualTo(EmailType.CUSTOMER_ENQUIRY_RECEIVED);
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Ihre Anfrage bei Studio Lichtblick");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Guten Tag Emma Clarke,")
            .contains("Sie ist bei <strong>Studio Lichtblick</strong> eingegangen.")
            .contains("antworten Sie einfach auf diese E-Mail")
            .contains("/p/" + studio.getSubdomain() + "\"")
            .contains("Portfolio ansehen");
    }

    @Test
    void anEnglishEnquiryIsAcknowledgedInEnglish() {
        Tenant studio = studio(t -> { });
        publishPhotoFor(studio);

        publishLead(studio, LeadCreatedEvent.Origin.PUBLIC_FORM, CustomerLanguage.EN);

        assertThat(valueAcrossTenants("SELECT recipient_email FROM outbox_jobs WHERE tenant_id = ?",
            studio.getId())).isEqualTo(CUSTOMER);
        assertThat(valueAcrossTenants("SELECT payload::text FROM outbox_jobs WHERE tenant_id = ?",
            studio.getId())).contains(EnquiryReceivedMessage.TEMPLATE).contains("\"EN\"").doesNotContain("<");

        EmailMessage mail = deliver();
        assertThat(mail.to()).isEqualTo(CUSTOMER);
        assertThat(mail.type()).isEqualTo(EmailType.CUSTOMER_ENQUIRY_RECEIVED);
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Your enquiry to Studio Lichtblick");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Hello Emma Clarke,")
            .contains("It has reached <strong>Studio Lichtblick</strong>.")
            .contains("simply reply to this email")
            .contains("View portfolio")
            .contains("Sent via Fotolio");
    }

    /**
     * Another studio's published photo must not count: the check runs under
     * this studio's RLS binding, so a portfolio with nothing on it gets no link.
     */
    @Test
    void noPortfolioLinkWhileTheStudiosPortfolioShowsNothing() {
        Tenant other = studio(t -> { });
        publishPhotoFor(other);
        Tenant studio = studio(t -> { });
        executeAcrossTenants("INSERT INTO photos (tenant_id, r2_key, is_published) VALUES (?, 'draft.jpg', false)",
            studio.getId());

        publishLead(studio, LeadCreatedEvent.Origin.PUBLIC_FORM, CustomerLanguage.DE);

        assertThat(deliver().htmlBody()).doesNotContain("/p/").doesNotContain("Portfolio ansehen");
    }

    @Test
    void withoutABusinessNameOrLegalEmailItFallsBackToLegalNameAndOwner() {
        Tenant studio = studio(t -> {
            t.setBusinessName(null);
            t.setLegalEmail(null);
            t.setLegalName("Anna Müller");
        });

        publishLead(studio, LeadCreatedEvent.Origin.PUBLIC_FORM, CustomerLanguage.DE);

        EmailMessage mail = deliver();
        assertThat(mail.fromName()).isEqualTo("Anna Müller");
        assertThat(mail.replyTo()).isEqualTo(studio.getOwnerEmail());
        assertThat(mail.subject()).isEqualTo("Ihre Anfrage bei Anna Müller");
    }

    @Test
    void aLeadEnteredByHandQueuesNothing() {
        Tenant studio = studio(t -> { });

        publishLead(studio, LeadCreatedEvent.Origin.ENTERED_BY_STUDIO, CustomerLanguage.DE);

        assertThat(countAcrossTenants("SELECT count(*) FROM outbox_jobs WHERE tenant_id = ?", studio.getId()))
            .isZero();
        deliverQueuedEmail();
        verify(sender, never()).send(any());
    }

    /** The photographer's new-lead alert still goes; only the Customer hears nothing. */
    @Test
    void theAcknowledgementSwitchedOffQueuesNothingToTheCustomer() {
        Tenant studio = studio(t -> t.setEnquiryAcknowledgementEnabled(false));

        publishLead(studio, LeadCreatedEvent.Origin.PUBLIC_FORM, CustomerLanguage.EN);

        assertThat(countAcrossTenants(
            "SELECT count(*) FROM outbox_jobs WHERE tenant_id = ? AND recipient_email = ?",
            studio.getId(), CUSTOMER)).isZero();
        assertThat(countAcrossTenants(
            "SELECT count(*) FROM outbox_jobs WHERE tenant_id = ? AND recipient_email = ?",
            studio.getId(), studio.getOwnerEmail())).isEqualTo(1);
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    private Tenant studio(Consumer<Tenant> customise) {
        String subdomain = "enquiry-" + UUID.randomUUID().toString().substring(0, 8);
        return new TransactionTemplate(txManager).execute(status -> {
            Tenant tenant = new Tenant(subdomain, "owner-" + subdomain + "@example.test");
            tenant.setBusinessName("Studio Lichtblick");
            tenant.setLegalEmail("hallo@lichtblick.test");
            customise.accept(tenant);
            return tenantRepository.save(tenant);
        });
    }

    private void publishPhotoFor(Tenant tenant) {
        executeAcrossTenants("INSERT INTO photos (tenant_id, r2_key, is_published) VALUES (?, 'p.jpg', true)",
            tenant.getId());
    }

    private static final LeadCreatedEvent.Details DETAILS =
        new LeadCreatedEvent.Details(java.time.LocalDate.of(2027, 6, 12), "WEDDING", null);

    private void publishLead(Tenant tenant, LeadCreatedEvent.Origin origin, CustomerLanguage language) {
        UUID leadId = UUID.randomUUID();
        LeadCreatedEvent event = origin == LeadCreatedEvent.Origin.PUBLIC_FORM
            ? LeadCreatedEvent.fromPublicForm(this, leadId, tenant.getId(), "Emma Clarke", CUSTOMER, "MED",
                DETAILS, language, tenant.getOwnerEmail(), CustomerLanguage.DE)
            : LeadCreatedEvent.enteredByStudio(this, leadId, tenant.getId(), "Emma Clarke", CUSTOMER, "MED",
                DETAILS, language, tenant.getOwnerEmail(), CustomerLanguage.DE);
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
        verify(sender, org.mockito.Mockito.atLeastOnce()).send(sent.capture());
        return sent.getAllValues().stream()
            .filter(m -> CUSTOMER.equals(m.to()))
            .reduce((a, b) -> {
                throw new AssertionError("more than one email to the Customer");
            })
            .orElseThrow(() -> new AssertionError("no email to the Customer"));
    }
}
