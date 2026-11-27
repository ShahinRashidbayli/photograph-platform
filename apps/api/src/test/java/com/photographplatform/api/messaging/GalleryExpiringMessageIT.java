package com.photographplatform.api.messaging;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.util.BusinessZone;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.gallery.service.GalleryRetentionService;
import com.photographplatform.api.messaging.application.GalleryExpiringMessage;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.service.EmailSender;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Gallery expiring, from the retention job to the Customer's inbox: the real
 * {@link GalleryRetentionService} sweep in a tenant transaction on Postgres,
 * the outbox row its {@code GalleryExpiringEvent} leaves, and that row rendered
 * by the real renderer and handed to the transport.
 *
 * <p>The schedule itself (15, 5, 1) is {@code GalleryRetentionIT}'s; this is
 * what the Customer reads.
 */
class GalleryExpiringMessageIT extends IntegrationTestBase {

    private static final String CUSTOMER = "emma@example.test";
    private static final String ROW = "SELECT %s FROM outbox_jobs WHERE tenant_id = ?";

    @Autowired private GalleryRetentionService retention;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private GalleryRepository galleryRepository;
    @Autowired private PlatformTransactionManager txManager;
    @Autowired private Clock clock;

    @MockitoBean private EmailSender sender;

    @BeforeEach
    void setUp() {
        reset(sender);
        when(sender.providerName()).thenReturn("test");
    }

    @Test
    void aGermanCustomerIsWarnedFifteenDaysOutWithSie() {
        Fixture fx = studio(Plan.PRO, CustomerLanguage.DE, Duration.ofDays(15), t -> { });

        sweep(fx);

        assertThat(row(fx, "recipient_email")).isEqualTo(CUSTOMER);
        assertThat(row(fx, "payload->>'fromName'")).isEqualTo("Studio Lichtblick");
        assertThat(row(fx, "payload->>'replyTo'")).isEqualTo("hallo@lichtblick.test");
        assertThat(row(fx, "payload->>'template'")).isEqualTo(GalleryExpiringMessage.TEMPLATE);
        assertThat(row(fx, "payload->'params'->>'language'")).isEqualTo("DE");
        assertThat(row(fx, "payload->'params'->>'galleryUrl'")).isEqualTo(link(fx));
        assertThat(row(fx, "idempotency_key")).startsWith("GALLERY_EXPIRING:" + fx.galleryId() + ":");
        // Dropped rather than delivered once the photos are gone.
        assertThat(row(fx, "expires_at")).isNotNull();

        String date = date(fx, "dd.MM.yyyy", Locale.GERMANY);
        EmailMessage mail = deliver();
        assertThat(mail.to()).isEqualTo(CUSTOMER);
        assertThat(mail.type()).isEqualTo(EmailType.GALLERY_EXPIRING);
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Ihre Fotos sind noch bis " + date + " online");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Guten Tag Emma Clarke,")
            .contains("Ihre Galerie von <strong>Studio Lichtblick</strong> ist noch bis zum <strong>"
                + date + "</strong> online.")
            .contains("Bitte laden Sie Ihre Fotos bis dahin herunter.")
            .contains("Sie brauchen mehr Zeit? Antworten Sie einfach auf diese E-Mail.")
            .contains("href=\"" + link(fx) + "\"")
            .contains("Versendet über Fotolio")
            // The old warning said "du"; a Customer message never does.
            .doesNotContain("deine")
            .doesNotContain("Du ");
    }

    @Test
    void anEnglishCustomerIsWarnedFiveDaysOutInEnglish() {
        Fixture fx = studio(Plan.PRO, CustomerLanguage.EN, Duration.ofDays(5), t -> { });

        sweep(fx);

        assertThat(row(fx, "recipient_email")).isEqualTo(CUSTOMER);
        assertThat(row(fx, "payload->>'fromName'")).isEqualTo("Studio Lichtblick");
        assertThat(row(fx, "payload->>'replyTo'")).isEqualTo("hallo@lichtblick.test");
        assertThat(row(fx, "payload->'params'->>'language'")).isEqualTo("EN");

        String date = date(fx, "d MMMM yyyy", Locale.ENGLISH);
        EmailMessage mail = deliver();
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Only 5 days left: your photos are online until " + date);
        assertThat(mail.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Hello Emma Clarke,")
            .contains("Your gallery from <strong>Studio Lichtblick</strong> is online until <strong>"
                + date + "</strong>.")
            .contains("Please download your photos before then.")
            .contains("Open gallery and download photos")
            .contains("href=\"" + link(fx) + "\"")
            .contains("Sent via Fotolio");
    }

    @Test
    void theLastWarningSaysSoInGerman() {
        Fixture fx = studio(Plan.PRO, CustomerLanguage.DE, Duration.ofHours(20), t -> { });

        sweep(fx);

        EmailMessage mail = deliver();
        assertThat(mail.subject())
            .isEqualTo("Letzte Erinnerung: Ihre Fotos sind nur noch bis " + date(fx, "dd.MM.yyyy", Locale.GERMANY)
                + " online");
        assertThat(mail.htmlBody()).contains("Letzte Erinnerung: Ihre Galerie geht offline");
    }

    /** On the Studio plan: the studio's logo and colour, and no word of Fotolio. */
    @Test
    void aWhiteLabelStudioWarnsInItsOwnLookInGerman() {
        Fixture fx = studio(Plan.STUDIO, CustomerLanguage.DE, Duration.ofDays(5), t -> t.setBrandColor("#AA3366"));

        sweep(fx);

        assertThat(row(fx, "payload->>'fromName'")).isEqualTo("Studio Lichtblick");
        assertThat(row(fx, "payload->>'replyTo'")).isEqualTo("hallo@lichtblick.test");
        assertThat(row(fx, "payload->'params'->>'language'")).isEqualTo("DE");
        EmailMessage mail = deliver();
        assertThat(mail.subject()).startsWith("Nur noch 5 Tage: Ihre Fotos sind bis ");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("<img src=\"http://localhost:3000/api/public/studios/" + fx.subdomain() + "/logo\"")
            .contains("#AA3366")
            .contains("Bitte laden Sie Ihre Fotos bis dahin herunter.")
            .doesNotContain("Fotolio");
    }

    @Test
    void aWhiteLabelStudioWarnsInItsOwnLookInEnglish() {
        Fixture fx = studio(Plan.STUDIO, CustomerLanguage.EN, Duration.ofDays(15), t -> { });

        sweep(fx);

        assertThat(row(fx, "payload->'params'->>'language'")).isEqualTo("EN");
        EmailMessage mail = deliver();
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).startsWith("Your photos are online until ");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("/api/public/studios/" + fx.subdomain() + "/logo")
            .contains("Please download your photos before then.")
            .doesNotContain("Fotolio");
    }

    /** The old warning named the studio by its subdomain; a Customer message never does. */
    @Test
    void theStudioFallsBackToTheLegalNameAndTheOwnersAddress() {
        Fixture fx = studio(Plan.PRO, CustomerLanguage.DE, Duration.ofDays(15), t -> {
            t.setBusinessName(null);
            t.setLegalEmail(null);
        });

        sweep(fx);

        assertThat(row(fx, "payload->>'fromName'")).isEqualTo("Anna Müller");
        assertThat(row(fx, "payload->>'replyTo'")).isEqualTo("owner-" + fx.subdomain() + "@example.test");
        assertThat(deliver().htmlBody())
            .contains("Ihre Galerie von <strong>Anna Müller</strong>")
            .doesNotContain(fx.subdomain() + "</strong>");
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    private record Fixture(Tenant tenant, String subdomain, UUID galleryId, String accessToken,
                           OffsetDateTime expiresAt) {
        UUID tenantId() {
            return tenant.getId();
        }
    }

    /** A studio with one live gallery that comes down {@code left} from now. */
    private Fixture studio(Plan plan, CustomerLanguage language, Duration left, Consumer<Tenant> customise) {
        String subdomain = "expiring-" + UUID.randomUUID().toString().substring(0, 8);
        TransactionTemplate tx = new TransactionTemplate(txManager);
        Tenant tenant = tx.execute(status -> {
            Tenant t = new Tenant(subdomain, "owner-" + subdomain + "@example.test");
            t.setPlan(plan);
            t.setBusinessName("Studio Lichtblick");
            t.setLegalName("Anna Müller");
            t.setLegalEmail("hallo@lichtblick.test");
            customise.accept(t);
            Tenant saved = tenantRepository.save(t);
            // The public logo route serves only the studio's own object.
            saved.setLogoKey("logos/" + saved.getId() + "/" + UUID.randomUUID() + ".png");
            return tenantRepository.save(saved);
        });
        TenantContext.setTenant(tenant.getId().toString());
        try {
            Gallery gallery = tx.execute(status -> {
                Booking booking = new Booking("Emma Clarke", CUSTOMER, LocalDate.now().minusDays(70));
                booking.setTenantId(tenant.getId());
                booking.setLanguage(language);
                UUID bookingId = bookingRepository.save(booking).getId();
                // A 60-day window that ends a minute short of `left` from now:
                // the job rounds days left up, so 15 days minus a minute is the
                // 15-day warning, and 15 days plus a moment would be none.
                OffsetDateTime deliveredAt = OffsetDateTime.now(clock).minusDays(60).plus(left).minusMinutes(1);
                Gallery g = new Gallery(bookingId, deliveredAt, 60, true, false);
                g.setTenantId(tenant.getId());
                return galleryRepository.save(g);
            });
            return new Fixture(tenant, subdomain, gallery.getId(), gallery.getAccessToken(), gallery.getExpiresAt());
        } finally {
            TenantContext.clear();
        }
    }

    /** One retention sweep for this studio, as {@code TenantJobRunner} runs it: bound and in a transaction. */
    private void sweep(Fixture fx) {
        TenantContext.setTenant(fx.tenantId().toString());
        try {
            int warned = new TransactionTemplate(txManager)
                .execute(status -> retention.sendDueReminders(fx.tenant()));
            assertThat(warned).isEqualTo(1);
        } finally {
            TenantContext.clear();
        }
    }

    private static String date(Fixture fx, String pattern, Locale locale) {
        return fx.expiresAt().atZoneSameInstant(BusinessZone.ID)
            .format(DateTimeFormatter.ofPattern(pattern, locale));
    }

    private static String link(Fixture fx) {
        return "http://localhost:3000/g/" + fx.subdomain() + "/" + fx.accessToken();
    }

    private String row(Fixture fx, String column) {
        return valueAcrossTenants(ROW.formatted(column), fx.tenantId());
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
