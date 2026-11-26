package com.photographplatform.api.gallery;

import com.photographplatform.api.common.repository.QueryLimits;
import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.gallery.config.RetentionProperties;
import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.domain.GalleryExpiryState;
import com.photographplatform.api.gallery.event.GalleryExpiringEvent;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryExpiryReminderRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.gallery.service.GalleryRetentionService;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Gallery retention end to end, against real Postgres and real RLS.
 *
 * <p>Written as an integration test rather than with mocked repositories
 * because the guarantees ADR-001 actually asks for are database guarantees:
 * the unique constraint that stops a client being emailed twice, the RLS
 * policies that keep one tenant's sweep out of another's galleries, and the
 * state transitions that decide whether someone's wedding photos still exist.
 *
 * <p>Time is injected rather than waited for — the service takes a {@link
 * Clock}, so each test builds one pinned wherever it needs to stand.
 */
class GalleryRetentionIT extends IntegrationTestBase {

    private static final Instant NOW = Instant.parse("2026-08-22T03:00:00Z");
    private static final OffsetDateTime NOW_AT = NOW.atOffset(ZoneOffset.UTC);

    @Autowired private GalleryRepository galleryRepository;
    @Autowired private GalleryExpiryReminderRepository reminderRepository;
    @Autowired private DeliveryPhotoRepository deliveryPhotoRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private AuditService auditService;
    @Autowired private PlatformTransactionManager txManager;

    /** What the sweep published; messaging's side is GalleryExpiringMessageIT. */
    private final List<GalleryExpiringEvent> warnings = new ArrayList<>();
    private final ApplicationEventPublisher events = event -> {
        if (event instanceof GalleryExpiringEvent warning) {
            warnings.add(warning);
        }
    };
    private R2StorageService storage;

    @BeforeEach
    void stubCollaborators() {
        warnings.clear();
        storage = mock(R2StorageService.class);
    }

    // ── phase 1: the client is warned (ADR-001 §4.1) ────────────────────

    @Test
    void aClientIsWarnedWhenTheGalleryCrossesAThreshold() {
        Fixture fx = tenantOn(Plan.STARTER);
        // 4 days left: inside the 5-day threshold, past the 15-day one.
        UUID galleryId = gallery(fx, NOW_AT.minusDays(56), 60);

        int warned = asTenant(fx, () -> service(NOW).sendDueReminders(fx.tenant()));

        assertThat(warned).isEqualTo(1);
        assertThat(warnings).singleElement().satisfies(warning -> {
            assertThat(warning.getGalleryId()).isEqualTo(galleryId);
            assertThat(warning.getTenantId()).isEqualTo(fx.tenantId());
            assertThat(warning.getRecipientEmail()).isEqualTo("maria@example.test");
            assertThat(warning.getRecipientName()).isEqualTo("Maria Kellner");
            assertThat(warning.getLanguage()).isEqualTo(CustomerLanguage.DE);
            assertThat(warning.getSubdomain()).isEqualTo(fx.tenant().getSubdomain());
            assertThat(warning.getAccessToken()).isEqualTo(load(fx, galleryId).getAccessToken());
            assertThat(warning.getExpiresAt()).isEqualTo(load(fx, galleryId).getExpiresAt());
            assertThat(warning.getDaysLeft()).isEqualTo(4);
        });
        assertThat(sentThresholds(fx, galleryId)).containsExactlyInAnyOrder(5, 15);
    }

    /**
     * The schedule the Customer is promised: one warning 15 days out, one at
     * 5, one the day before. A gallery walked through its last weeks one day
     * at a time is warned on exactly those three days, and on no other.
     */
    @Test
    void theCustomerIsWarnedFifteenFiveAndOneDayBeforeExpiry() {
        Fixture fx = tenantOn(Plan.STARTER);
        UUID galleryId = gallery(fx, NOW_AT.minusDays(30), 60);
        OffsetDateTime expiresAt = load(fx, galleryId).getExpiresAt();

        List<Long> warnedOn = new ArrayList<>();
        for (long daysLeft = 20; daysLeft >= 1; daysLeft--) {
            Instant at = expiresAt.minusDays(daysLeft).toInstant();
            int warned = inTenantTx(fx, () -> service(at).sendDueReminders(fx.tenant()));
            if (warned > 0) {
                warnedOn.add(daysLeft);
            }
        }

        assertThat(warnedOn).containsExactly(15L, 5L, 1L);
        assertThat(warnings).extracting(GalleryExpiringEvent::getDaysLeft).containsExactly(15, 5, 1);
        assertThat(sentThresholds(fx, galleryId)).containsExactlyInAnyOrder(1, 5, 15);
    }

    /** The Customer's language travels from the booking, so the warning is in it. */
    @Test
    void theWarningCarriesTheCustomersLanguage() {
        Fixture fx = tenantOn(Plan.STARTER);
        UUID galleryId = gallery(fx, NOW_AT.minusDays(56), 60);
        inTenantTx(fx, () -> {
            Booking booking = bookingRepository.findById(load(fx, galleryId).getBookingId()).orElseThrow();
            booking.setLanguage(CustomerLanguage.EN);
            return bookingRepository.save(booking);
        });

        asTenant(fx, () -> service(NOW).sendDueReminders(fx.tenant()));

        assertThat(warnings).singleElement()
            .extracting(GalleryExpiringEvent::getLanguage).isEqualTo(CustomerLanguage.EN);
    }

    /**
     * The reason the ledger has a unique constraint. A re-run — or two
     * instances overlapping past a lease — must not email a client twice in
     * one morning about their wedding photos expiring.
     */
    @Test
    void rerunningTheSweepWarnsNobodyTwice() {
        Fixture fx = tenantOn(Plan.STARTER);
        gallery(fx, NOW_AT.minusDays(56), 60);

        asTenant(fx, () -> service(NOW).sendDueReminders(fx.tenant()));
        int secondRun = asTenant(fx, () -> service(NOW).sendDueReminders(fx.tenant()));

        assertThat(secondRun).isZero();
        assertThat(warnings).hasSize(1);
    }

    /**
     * After downtime a gallery can cross several thresholds at once. The
     * client should get the warning that is still true — not the stale
     * "15 days left" one, and not three emails.
     */
    @Test
    void afterDowntimeOnlyTheMostUrgentWarningIsSent() {
        Fixture fx = tenantOn(Plan.STARTER);
        // 3 days left: 15 and 5 have both been passed, neither was sent.
        UUID galleryId = gallery(fx, NOW_AT.minusDays(57), 60);

        asTenant(fx, () -> service(NOW).sendDueReminders(fx.tenant()));

        assertThat(warnings).singleElement()
            .extracting(GalleryExpiringEvent::getDaysLeft).isEqualTo(3);
        // Both are recorded, so the stale 15-day warning can never fire later.
        assertThat(sentThresholds(fx, galleryId)).containsExactlyInAnyOrder(5, 15);
    }

    @Test
    void aGalleryFarFromExpiryIsLeftAlone() {
        Fixture fx = tenantOn(Plan.PRO);
        gallery(fx, NOW_AT.minusDays(10), 365);

        int warned = asTenant(fx, () -> service(NOW).sendDueReminders(fx.tenant()));

        assertThat(warned).isZero();
        assertThat(warnings).isEmpty();
    }

    // ── phase 2: access is revoked, bytes stay (ADR-001 §4.3) ───────────

    @Test
    void anExpiredGalleryLosesAccessButKeepsItsPhotos() {
        Fixture fx = tenantOn(Plan.STARTER);
        UUID galleryId = gallery(fx, NOW_AT.minusDays(61), 60);
        photo(fx, galleryId, "originals/a.jpg");

        int expired = asTenant(fx, () -> service(NOW).expireDue(fx.tenant()));

        assertThat(expired).isEqualTo(1);
        Gallery after = load(fx, galleryId);
        assertThat(after.getExpiryState()).isEqualTo(GalleryExpiryState.EXPIRED);
        assertThat(after.getSoftDeletedAt()).isNotNull();
        assertThat(after.getPurgeAfter()).isEqualTo(NOW_AT.plusDays(30));
        assertThat(after.isReachable(NOW_AT)).isFalse();
        // The whole point of soft-delete: the bytes are still there.
        assertThat(asTenant(fx, () -> deliveryPhotoRepository
            .findByGalleryIdOrderBySortOrderAsc(galleryId, QueryLimits.LIST))).hasSize(1);
        verifyNoInteractions(storage);
    }

    /**
     * The sweep runs nightly, so between the moment a gallery expires and the
     * moment the job reaches it, the row still says ACTIVE. Serving photos in
     * that window would hand out up to a day past what the plan sold.
     */
    @Test
    void aGalleryPastItsDateIsUnreachableBeforeTheSweepEvenReachesIt() {
        Fixture fx = tenantOn(Plan.STARTER);
        UUID galleryId = gallery(fx, NOW_AT.minusDays(61), 60);

        Gallery stillMarkedActive = load(fx, galleryId);
        assertThat(stillMarkedActive.getExpiryState()).isEqualTo(GalleryExpiryState.ACTIVE);
        assertThat(stillMarkedActive.isReachable(NOW_AT)).isFalse();
    }

    // ── phase 3: the irreversible one ───────────────────────────────────

    /**
     * Off unless explicitly enabled. A staging database restored from a
     * production dump must not delete real customers' photos on its first
     * night (ADR-001 §4.4 also gates the first deletion on the AGB wording).
     */
    @Test
    void purgeDoesNothingUntilItIsExplicitlyEnabled() {
        Fixture fx = tenantOn(Plan.STARTER);
        UUID galleryId = expiredGallery(fx, NOW_AT.minusDays(31));

        int purged = asTenant(fx, () -> service(NOW).purgeDue(fx.tenant()));

        assertThat(purged).isZero();
        assertThat(load(fx, galleryId).getExpiryState()).isEqualTo(GalleryExpiryState.EXPIRED);
        verifyNoInteractions(storage);
    }

    @Test
    void purgeDeletesTheBytesAndLeavesATombstone() {
        Fixture fx = tenantOn(Plan.STARTER);
        UUID galleryId = expiredGallery(fx, NOW_AT.minusDays(31));
        photo(fx, galleryId, "originals/a.jpg");
        warn(fx, galleryId);

        int purged = asTenant(fx, () -> purgingService(NOW).purgeDue(fx.tenant()));

        assertThat(purged).isEqualTo(1);
        verify(storage).deleteObjects(any());
        assertThat(asTenant(fx, () -> deliveryPhotoRepository
            .findByGalleryIdOrderBySortOrderAsc(galleryId, QueryLimits.LIST))).isEmpty();

        Gallery tombstone = load(fx, galleryId);
        assertThat(tombstone.getExpiryState()).isEqualTo(GalleryExpiryState.PURGED);
        assertThat(tombstone.getPurgedAt()).isNotNull();
        assertThat(tombstone.canExtend()).isFalse();
    }

    /**
     * The grace period is margin for OUR bugs. A gallery that expired
     * yesterday is not eligible, however loudly the date says it is old.
     */
    @Test
    void purgeIgnoresGalleriesStillInsideTheirGracePeriod() {
        Fixture fx = tenantOn(Plan.STARTER);
        UUID galleryId = expiredGallery(fx, NOW_AT.minusDays(1));
        warn(fx, galleryId);

        assertThat(asTenant(fx, () -> purgingService(NOW).purgeDue(fx.tenant()))).isZero();
        assertThat(load(fx, galleryId).getExpiryState()).isEqualTo(GalleryExpiryState.EXPIRED);
    }

    /**
     * The safety net for the ADR's central requirement. If the reminder phase
     * never ran for a gallery, purging it on schedule is precisely the silent
     * vanishing §4.1 exists to forbid — so it refuses and says so.
     */
    @Test
    void purgeRefusesAGalleryWhoseClientWasNeverWarned() {
        Fixture fx = tenantOn(Plan.STARTER);
        UUID galleryId = expiredGallery(fx, NOW_AT.minusDays(31));
        photo(fx, galleryId, "originals/a.jpg");
        // deliberately no reminder rows

        assertThat(asTenant(fx, () -> purgingService(NOW).purgeDue(fx.tenant()))).isZero();
        assertThat(load(fx, galleryId).getExpiryState()).isEqualTo(GalleryExpiryState.EXPIRED);
        verifyNoInteractions(storage);
        assertThat(asTenant(fx, () -> deliveryPhotoRepository
            .findByGalleryIdOrderBySortOrderAsc(galleryId, QueryLimits.LIST))).hasSize(1);
    }

    // ── recovery (ADR-001 §4.2) ─────────────────────────────────────────

    /**
     * The photographer who notices late is exactly who the grace period is
     * for: without recovery here, every missed window becomes a support ticket
     * nobody can resolve because the data is already gone.
     */
    @Test
    void extendingBringsAnExpiredGalleryBack() {
        Fixture fx = tenantOn(Plan.STARTER);
        UUID galleryId = expiredGallery(fx, NOW_AT.minusDays(5));

        inTenantTx(fx, () -> {
            Gallery gallery = galleryRepository.findById(galleryId).orElseThrow();
            gallery.extend(NOW_AT, 60);
            galleryRepository.save(gallery);
            return null;
        });

        Gallery revived = load(fx, galleryId);
        assertThat(revived.getExpiryState()).isEqualTo(GalleryExpiryState.ACTIVE);
        assertThat(revived.isReachable(NOW_AT)).isTrue();
        // A full window from now, not the remainder of a window that already
        // passed — restoring into an expired window would help nobody.
        assertThat(revived.getExpiresAt()).isEqualTo(NOW_AT.plusDays(60));
        assertThat(revived.getSoftDeletedAt()).isNull();
        assertThat(revived.getPurgeAfter()).isNull();
        assertThat(revived.getExtensionCount()).isEqualTo(1);

        // ...and it is no longer eligible for purge.
        warn(fx, galleryId);
        assertThat(asTenant(fx, () -> purgingService(NOW).purgeDue(fx.tenant()))).isZero();
    }

    // ── tenant isolation ────────────────────────────────────────────────

    /**
     * The sweep runs with no HTTP request behind it, so nothing but RLS keeps
     * it inside one tenant. A job that walked every tenant's galleries under
     * one binding would delete other people's photos.
     */
    @Test
    void theSweepOnlyEverTouchesTheTenantItIsBoundTo() {
        Fixture a = tenantOn(Plan.STARTER);
        Fixture b = tenantOn(Plan.STARTER);
        UUID galleryOfA = gallery(a, NOW_AT.minusDays(61), 60);
        UUID galleryOfB = gallery(b, NOW_AT.minusDays(61), 60);

        int expiredForA = asTenant(a, () -> service(NOW).expireDue(a.tenant()));

        assertThat(expiredForA).isEqualTo(1);
        assertThat(load(a, galleryOfA).getExpiryState()).isEqualTo(GalleryExpiryState.EXPIRED);
        assertThat(load(b, galleryOfB).getExpiryState()).isEqualTo(GalleryExpiryState.ACTIVE);
    }

    // ── fixtures ────────────────────────────────────────────────────────

    private record Fixture(Tenant tenant) {
        UUID tenantId() {
            return tenant.getId();
        }
    }

    private GalleryRetentionService service(Instant at) {
        return buildService(at, new RetentionProperties());
    }

    private GalleryRetentionService purgingService(Instant at) {
        RetentionProperties props = new RetentionProperties();
        props.setPurgeEnabled(true);
        return buildService(at, props);
    }

    private GalleryRetentionService buildService(Instant at, RetentionProperties props) {
        props.validate();
        return new GalleryRetentionService(
            galleryRepository, reminderRepository, deliveryPhotoRepository, bookingRepository,
            events, Optional.of(storage), auditService, props,
            Clock.fixed(at, ZoneOffset.UTC));
    }

    private Fixture tenantOn(Plan plan) {
        Tenant tenant = new TransactionTemplate(txManager).execute(status -> {
            Tenant fresh = new Tenant(
                "retention-" + UUID.randomUUID().toString().substring(0, 8),
                "owner-" + UUID.randomUUID() + "@example.test");
            fresh.setPlan(plan);
            return tenantRepository.save(fresh);
        });
        return new Fixture(tenant);
    }

    /** A live gallery delivered {@code deliveredAt}, with a booking behind it. */
    private UUID gallery(Fixture fx, OffsetDateTime deliveredAt, int retentionDays) {
        return inTenantTx(fx, () -> {
            Booking booking = new Booking("Maria Kellner", "maria@example.test", LocalDate.now());
            booking.setTenantId(fx.tenantId());
            booking = bookingRepository.save(booking);

            Gallery gallery = new Gallery(booking.getId(), deliveredAt, retentionDays, true, false);
            gallery.setTenantId(fx.tenantId());
            return galleryRepository.save(gallery).getId();
        });
    }

    /** A gallery already soft-deleted {@code softDeletedAt}. */
    private UUID expiredGallery(Fixture fx, OffsetDateTime softDeletedAt) {
        UUID galleryId = gallery(fx, softDeletedAt.minusDays(60), 60);
        return inTenantTx(fx, () -> {
            Gallery gallery = galleryRepository.findById(galleryId).orElseThrow();
            gallery.markExpired(softDeletedAt, 30);
            galleryRepository.save(gallery);
            return galleryId;
        });
    }

    private void photo(Fixture fx, UUID galleryId, String key) {
        inTenantTx(fx, () -> {
            DeliveryPhoto photo = new DeliveryPhoto(galleryId, key, "a.jpg");
            photo.setTenantId(fx.tenantId());
            photo.setThumbnailKey(key + ".thumb");
            return deliveryPhotoRepository.save(photo);
        });
    }

    /** Records that the client was warned, without going through the emailer. */
    private void warn(Fixture fx, UUID galleryId) {
        inTenantTx(fx, () -> reminderRepository.save(
            new com.photographplatform.api.gallery.domain.GalleryExpiryReminder(
                fx.tenantId(), galleryId, 1)));
    }

    private List<Integer> sentThresholds(Fixture fx, UUID galleryId) {
        return asTenant(fx, () -> reminderRepository.findSentThresholds(galleryId));
    }

    private Gallery load(Fixture fx, UUID galleryId) {
        return inTenantTx(fx, () -> galleryRepository.findById(galleryId).orElseThrow());
    }

    private <T> T asTenant(Fixture fx, Supplier<T> action) {
        TenantContext.setTenant(fx.tenantId().toString());
        try {
            return action.get();
        } finally {
            TenantContext.clear();
        }
    }

    private <T> T inTenantTx(Fixture fx, Supplier<T> action) {
        return asTenant(fx, () -> new TransactionTemplate(txManager).execute(status -> action.get()));
    }
}
