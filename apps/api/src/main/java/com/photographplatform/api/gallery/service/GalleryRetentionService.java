package com.photographplatform.api.gallery.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.gallery.config.RetentionProperties;
import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.domain.GalleryExpiryReminder;
import com.photographplatform.api.gallery.event.GalleryExpiringEvent;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryExpiryReminderRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.common.repository.QueryLimits;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/**
 * The three phases a gallery passes through on its way out (ADR-001).
 *
 * <p>Split into warn → expire → purge rather than one "delete what is old"
 * pass, because ADR-001 refuses to let deletion be a single step: the client
 * must be warned first (§4.1), the photographer must be able to pull it back
 * (§4.2), and the bytes must outlive the loss of access by a margin that
 * covers <em>our own</em> bugs (§4.3).
 *
 * <p>Every method here is called once per tenant from inside
 * {@code TenantJobRunner}, with {@code app.tenant_id} bound and inside that
 * tenant's transaction. They must not be called with no tenant bound: RLS
 * fails closed, so they would report "nothing to do" rather than failing.
 */
@Service
public class GalleryRetentionService {

    private static final Logger LOG = LoggerFactory.getLogger(GalleryRetentionService.class);

    private final GalleryRepository galleryRepository;
    private final GalleryExpiryReminderRepository reminderRepository;
    private final DeliveryPhotoRepository deliveryPhotoRepository;
    private final BookingRepository bookingRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final Optional<R2StorageService> storage;
    private final AuditService auditService;
    private final RetentionProperties properties;
    private final Clock clock;

    public GalleryRetentionService(
        GalleryRepository galleryRepository,
        GalleryExpiryReminderRepository reminderRepository,
        DeliveryPhotoRepository deliveryPhotoRepository,
        BookingRepository bookingRepository,
        ApplicationEventPublisher eventPublisher,
        Optional<R2StorageService> storage,
        AuditService auditService,
        RetentionProperties properties,
        Clock clock) {
        this.galleryRepository = galleryRepository;
        this.reminderRepository = reminderRepository;
        this.deliveryPhotoRepository = deliveryPhotoRepository;
        this.bookingRepository = bookingRepository;
        this.eventPublisher = eventPublisher;
        this.storage = storage;
        this.auditService = auditService;
        this.properties = properties;
        this.clock = clock;
    }

    // ── phase 1: warn the client (ADR-001 §4.1) ─────────────────────────

    /**
     * Warns the Customer, through {@link GalleryExpiringEvent}, about every
     * gallery that has crossed a warning threshold, and records that it did.
     *
     * <p>Only the most urgent unsent threshold is emailed per gallery per run,
     * but every threshold that has been passed is recorded. That matters after
     * downtime: if the job misses a week and a gallery goes from 20 days left
     * to 3, the client should get the "5 days" warning — not the "15 days" one
     * that is now false, and not both at once.
     */
    public int sendDueReminders(Tenant tenant) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<Integer> thresholds = properties.sortedThresholds();
        int widest = thresholds.get(thresholds.size() - 1);

        List<Gallery> candidates = galleryRepository.findDueForReminder(
            now, now.plusDays(widest), PageRequest.ofSize(properties.getMaxPerRun()));

        int warned = 0;
        for (Gallery gallery : candidates) {
            if (sendReminderFor(tenant, gallery, now, thresholds)) {
                warned++;
            }
        }
        return warned;
    }

    private boolean sendReminderFor(
        Tenant tenant, Gallery gallery, OffsetDateTime now, List<Integer> thresholds) {

        long daysLeft = daysUntil(now, gallery.getExpiresAt());
        Set<Integer> alreadySent = new HashSet<>(
            reminderRepository.findSentThresholds(gallery.getId()));

        // Ascending, so the first match is the most urgent warning that applies.
        List<Integer> passed = thresholds.stream().filter(t -> daysLeft <= t).toList();
        List<Integer> unsent = passed.stream().filter(t -> !alreadySent.contains(t)).toList();
        if (unsent.isEmpty()) {
            return false;
        }

        Booking booking = bookingRepository.findById(gallery.getBookingId()).orElse(null);
        if (booking == null || booking.getClientEmail() == null || booking.getClientEmail().isBlank()) {
            // Nothing to warn. Logged at WARN rather than skipped silently:
            // ADR-001 makes the client warning a precondition for deletion, so
            // a gallery that can never be warned about is a gallery that
            // should never be purged — and purgeDue() enforces exactly that.
            LOG.warn("Gallery {} has no client email; cannot send an expiry warning", gallery.getId());
            return false;
        }

        // Record every passed threshold, email only the most urgent. The
        // unique constraint on (gallery_id, days_before) is what makes this
        // idempotent — a re-run inserts nothing and sends nothing.
        for (Integer threshold : unsent) {
            reminderRepository.save(
                new GalleryExpiryReminder(tenant.getId(), gallery.getId(), threshold));
        }

        // messaging writes the warning, in the Customer's language and the
        // studio's name, before this transaction commits: with the reminder
        // rows above, or not at all.
        eventPublisher.publishEvent(new GalleryExpiringEvent(
            this,
            gallery.getId(),
            tenant.getId(),
            booking.getClientEmail(),
            booking.getClientName(),
            booking.getLanguage(),
            tenant.getSubdomain(),
            gallery.getAccessToken(),
            gallery.getExpiresAt(),
            (int) Math.max(0, daysLeft)));
        return true;
    }

    // ── phase 2: revoke access, keep the bytes (ADR-001 §4.3) ───────────

    public int expireDue(Tenant tenant) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<Gallery> due = galleryRepository.findDueForExpiry(
            now, PageRequest.ofSize(properties.getMaxPerRun()));

        for (Gallery gallery : due) {
            gallery.markExpired(now, properties.getGraceDays());
            galleryRepository.save(gallery);
            // actor null: this is the system acting, not a person. audit_log is
            // one of the tables V11 left outside RLS, so the @Async write
            // lands correctly even though it runs off this tenant-bound thread.
            auditService.log(
                "GALLERY_EXPIRED", "gallery", gallery.getId(), tenant.getId(), null, null);
        }
        if (!due.isEmpty()) {
            LOG.info("Expired {} galleries for tenant {} (bytes retained until purge)",
                due.size(), tenant.getSubdomain());
        }
        return due.size();
    }

    // ── phase 3: destroy the bytes ──────────────────────────────────────

    /**
     * The irreversible one.
     *
     * <p>Guarded three ways beyond the date itself: the phase is off unless
     * explicitly enabled, only rows already in EXPIRED past their grace period
     * are eligible, and a gallery whose client was never warned is skipped
     * rather than deleted. That last check is the one that catches a genuine
     * bug — if the reminder phase never ran, deleting on schedule would be
     * exactly the silent vanishing ADR-001 §4.1 forbids.
     */
    public int purgeDue(Tenant tenant) {
        if (!properties.isPurgeEnabled()) {
            return 0;
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<Gallery> due = galleryRepository.findDueForPurge(
            now, PageRequest.ofSize(properties.getMaxPerRun()));

        int purged = 0;
        for (Gallery gallery : due) {
            if (reminderRepository.findSentThresholds(gallery.getId()).isEmpty()) {
                LOG.error(
                    "Refusing to purge gallery {} (tenant {}): no expiry warning was ever sent to "
                        + "the client. ADR-001 §4.1 makes that a precondition for deletion — this "
                        + "means the reminder phase did not run for this gallery.",
                    gallery.getId(), tenant.getSubdomain());
                continue;
            }
            purgeOne(tenant, gallery);
            purged++;
        }
        if (purged > 0) {
            LOG.info("Purged {} galleries for tenant {}", purged, tenant.getSubdomain());
        }
        return purged;
    }

    private void purgeOne(Tenant tenant, Gallery gallery) {
        List<DeliveryPhoto> photos =
            deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(gallery.getId(), QueryLimits.LIST);

        List<String> keys = photos.stream()
            .flatMap(photo -> DeliveryPhotoKeys.of(photo).stream())
            .filter(Objects::nonNull)
            .toList();

        // Object storage first, rows second. The other order would leave rows
        // pointing at objects we then failed to delete — invisible orphans
        // billed forever. This order's failure mode is a retry that deletes
        // already-absent keys, which deleteObjects tolerates by design.
        if (!keys.isEmpty()) {
            storage.ifPresent(r2 -> r2.deleteObjects(keys));
        }
        deliveryPhotoRepository.deleteAll(photos);

        gallery.markPurged(OffsetDateTime.now(clock));
        galleryRepository.save(gallery);
        auditService.log("GALLERY_PURGED", "gallery", gallery.getId(), tenant.getId(), null, null);
    }

    // ── helpers ─────────────────────────────────────────────────────────

    /**
     * Whole days remaining, rounded UP.
     *
     * <p>Rounding up is deliberate: with truncation a gallery expiring in 30
     * hours reports "1 day left" and gets the final-warning email a day early,
     * while one expiring in 20 hours reports 0 and would be described to the
     * client as expiring today when it actually has until tomorrow. Telling
     * someone their wedding photos vanish sooner than they do is the error
     * worth avoiding.
     */
    static long daysUntil(OffsetDateTime now, OffsetDateTime expiresAt) {
        if (expiresAt == null) {
            return Long.MAX_VALUE;
        }
        Duration remaining = Duration.between(now, expiresAt);
        if (remaining.isNegative() || remaining.isZero()) {
            return 0;
        }
        long days = remaining.toDays();
        return remaining.minusDays(days).isZero() ? days : days + 1;
    }
}
