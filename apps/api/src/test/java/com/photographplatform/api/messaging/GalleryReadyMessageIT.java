package com.photographplatform.api.messaging;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.gallery.service.GalleryService;
import com.photographplatform.api.messaging.application.GalleryReadyMessage;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.service.EmailSender;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
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
 * Gallery ready, from the photographer's click to the Customer's inbox: a real
 * {@link GalleryService} send on Postgres, the outbox row it leaves, and that
 * row rendered by the real renderer and handed to the transport.
 */
class GalleryReadyMessageIT extends IntegrationTestBase {

    private static final String CUSTOMER = "emma@example.test";
    private static final String ROW = "SELECT %s FROM outbox_jobs WHERE tenant_id = ?";

    @Autowired private GalleryService galleryService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private GalleryRepository galleryRepository;
    @Autowired private DeliveryPhotoRepository photoRepository;
    @Autowired private PlatformTransactionManager txManager;

    @MockitoBean private EmailSender sender;

    @BeforeEach
    void setUp() {
        reset(sender);
        when(sender.providerName()).thenReturn("test");
    }

    @Test
    void sendingTellsAGermanCustomerInTheStudiosName() {
        Fixture fx = studio(Plan.PRO, CustomerLanguage.DE, 2, t -> { });

        as(fx, () -> galleryService.send(fx.galleryId(), null, null));

        assertThat(row(fx, "recipient_email")).isEqualTo(CUSTOMER);
        assertThat(row(fx, "payload->>'fromName'")).isEqualTo("Studio Lichtblick");
        assertThat(row(fx, "payload->>'replyTo'")).isEqualTo("hallo@lichtblick.test");
        assertThat(row(fx, "payload->>'template'")).isEqualTo(GalleryReadyMessage.TEMPLATE);
        assertThat(row(fx, "payload->'params'->>'language'")).isEqualTo("DE");
        assertThat(row(fx, "payload->'params'->>'galleryUrl'")).isEqualTo(link(fx));
        assertThat(row(fx, "idempotency_key")).startsWith("GALLERY_READY:" + fx.galleryId() + ":");

        EmailMessage mail = deliver();
        assertThat(mail.to()).isEqualTo(CUSTOMER);
        assertThat(mail.type()).isEqualTo(EmailType.GALLERY_READY);
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Ihre Galerie von Studio Lichtblick ist bereit");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Guten Tag Emma Clarke,")
            .contains("<strong>Studio Lichtblick</strong> hat Ihre Galerie fertiggestellt.")
            .contains("Sie können Ihre Fotos ab sofort online ansehen.")
            .contains("Galerie öffnen")
            .contains("href=\"" + link(fx) + "\"")
            .contains("Versendet über Fotolio")
            .doesNotContain("<img");
    }

    @Test
    void sendingTellsAnEnglishCustomerInEnglish() {
        Fixture fx = studio(Plan.PRO, CustomerLanguage.EN, 1, t -> { });

        as(fx, () -> galleryService.send(fx.galleryId(), null, null));

        assertThat(row(fx, "recipient_email")).isEqualTo(CUSTOMER);
        assertThat(row(fx, "payload->>'fromName'")).isEqualTo("Studio Lichtblick");
        assertThat(row(fx, "payload->>'replyTo'")).isEqualTo("hallo@lichtblick.test");
        assertThat(row(fx, "payload->'params'->>'language'")).isEqualTo("EN");

        EmailMessage mail = deliver();
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Your gallery from Studio Lichtblick is ready");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Hello Emma Clarke,")
            .contains("<strong>Studio Lichtblick</strong> has finished your gallery.")
            .contains("Open gallery")
            .contains("href=\"" + link(fx) + "\"")
            .contains("Sent via Fotolio");
    }

    /** On the Studio plan: the studio's logo and colour, and no word of Fotolio. */
    @Test
    void aWhiteLabelStudioSendsInItsOwnLookInGerman() {
        Fixture fx = studio(Plan.STUDIO, CustomerLanguage.DE, 1, t -> t.setBrandColor("#AA3366"));

        as(fx, () -> galleryService.send(fx.galleryId(), null, null));

        assertThat(row(fx, "payload->>'fromName'")).isEqualTo("Studio Lichtblick");
        assertThat(row(fx, "payload->>'replyTo'")).isEqualTo("hallo@lichtblick.test");
        assertThat(row(fx, "payload->'params'->>'language'")).isEqualTo("DE");
        EmailMessage mail = deliver();
        assertThat(mail.subject()).isEqualTo("Ihre Galerie von Studio Lichtblick ist bereit");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("<img src=\"http://localhost:3000/api/public/studios/" + fx.subdomain() + "/logo\"")
            .contains("#AA3366")
            .contains("Galerie öffnen")
            .doesNotContain("Fotolio");
    }

    @Test
    void aWhiteLabelStudioSendsInItsOwnLookInEnglish() {
        Fixture fx = studio(Plan.STUDIO, CustomerLanguage.EN, 1, t -> t.setBrandColor("#AA3366"));

        as(fx, () -> galleryService.send(fx.galleryId(), null, null));

        assertThat(row(fx, "payload->'params'->>'language'")).isEqualTo("EN");
        EmailMessage mail = deliver();
        assertThat(mail.fromName()).isEqualTo("Studio Lichtblick");
        assertThat(mail.replyTo()).isEqualTo("hallo@lichtblick.test");
        assertThat(mail.subject()).isEqualTo("Your gallery from Studio Lichtblick is ready");
        assertThat(mail.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("/api/public/studios/" + fx.subdomain() + "/logo")
            .contains("Open gallery")
            .doesNotContain("Fotolio");
    }

    /** Without a legal email, a reply goes to the owner; without a business name, the legal name speaks. */
    @Test
    void theStudioFallsBackToTheLegalNameAndTheOwnersAddress() {
        Fixture fx = studio(Plan.PRO, CustomerLanguage.DE, 1, t -> {
            t.setBusinessName(null);
            t.setLegalEmail(null);
        });

        as(fx, () -> galleryService.send(fx.galleryId(), null, null));

        assertThat(row(fx, "payload->>'fromName'")).isEqualTo("Anna Müller");
        assertThat(row(fx, "payload->>'replyTo'")).isEqualTo("owner-" + fx.subdomain() + "@example.test");
        assertThat(deliver().subject()).isEqualTo("Ihre Galerie von Anna Müller ist bereit");
    }

    @Test
    void aGalleryWithNoPhotosCannotBeSent() {
        Fixture fx = studio(Plan.PRO, CustomerLanguage.DE, 0, t -> { });

        assertThatThrownBy(() -> as(fx, () -> galleryService.send(fx.galleryId(), null, null)))
            .isInstanceOf(ConflictException.class);
        assertThat(countAcrossTenants("SELECT count(*) FROM outbox_jobs WHERE tenant_id = ?", fx.tenantId()))
            .isZero();
    }

    /** Each click is one message, and neither touches the retention clock. */
    @Test
    void twoSendsQueueTwoMessagesAndLeaveTheRetentionClockAlone() {
        Fixture fx = studio(Plan.PRO, CustomerLanguage.DE, 1, t -> { });
        OffsetDateTime expiresAt = gallery(fx).getExpiresAt();
        OffsetDateTime deliveredAt = gallery(fx).getDeliveredAt();

        as(fx, () -> galleryService.send(fx.galleryId(), null, null));
        as(fx, () -> galleryService.send(fx.galleryId(), null, null));

        assertThat(countAcrossTenants(
            "SELECT count(*) FROM outbox_jobs WHERE tenant_id = ? AND idempotency_key LIKE 'GALLERY_READY:%'",
            fx.tenantId())).isEqualTo(2);
        assertThat(gallery(fx).getExpiresAt()).isEqualTo(expiresAt);
        assertThat(gallery(fx).getDeliveredAt()).isEqualTo(deliveredAt);
    }

    /**
     * The note is the photographer's plain text: markup in it shows as text and
     * cannot pass for part of the email, a link least of all.
     */
    @Test
    void aPersonalNoteWithHtmlIsEscaped() {
        Fixture fx = studio(Plan.PRO, CustomerLanguage.DE, 1, t -> { });
        String note = "Viel Freude!\n<a href=\"https://evil.test\">Jetzt bezahlen</a>";

        as(fx, () -> galleryService.send(fx.galleryId(), note, null));

        assertThat(deliver().htmlBody())
            .contains("Viel Freude!<br>&lt;a href=&quot;https://evil.test&quot;&gt;Jetzt bezahlen&lt;/a&gt;")
            .doesNotContain("<a href=\"https://evil.test\"");
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    private record Fixture(UUID tenantId, UUID userId, String subdomain, UUID galleryId, String accessToken) {
    }

    private Fixture studio(Plan plan, CustomerLanguage language, int photos, Consumer<Tenant> customise) {
        String subdomain = "gallery-" + UUID.randomUUID().toString().substring(0, 8);
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
        UUID tenantId = tenant.getId();
        TenantContext.setTenant(tenantId.toString());
        try {
            UUID userId = tx.execute(status -> userRepository.save(
                new User(tenantId, "photographer-" + subdomain + "@example.test", "hash", "Anna")).getId());
            Gallery gallery = tx.execute(status -> {
                Booking booking = new Booking("Emma Clarke", CUSTOMER, LocalDate.now().plusDays(30));
                booking.setTenantId(tenantId);
                booking.setLanguage(language);
                UUID bookingId = bookingRepository.save(booking).getId();
                Gallery g = new Gallery(bookingId, OffsetDateTime.now(), 60, true, false);
                g.setTenantId(tenantId);
                g = galleryRepository.save(g);
                for (int i = 0; i < photos; i++) {
                    DeliveryPhoto photo = new DeliveryPhoto(g.getId(), "k/" + i + ".jpg", i + ".jpg");
                    photo.setTenantId(tenantId);
                    photoRepository.save(photo);
                }
                return g;
            });
            return new Fixture(tenantId, userId, subdomain, gallery.getId(), gallery.getAccessToken());
        } finally {
            TenantContext.clear();
        }
    }

    private static String link(Fixture fx) {
        return "http://localhost:3000/g/" + fx.subdomain() + "/" + fx.accessToken();
    }

    private Gallery gallery(Fixture fx) {
        return as(fx, () -> new TransactionTemplate(txManager)
            .execute(status -> galleryRepository.findById(fx.galleryId()).orElseThrow()));
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
