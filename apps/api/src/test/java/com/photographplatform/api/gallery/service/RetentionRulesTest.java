package com.photographplatform.api.gallery.service;

import com.photographplatform.api.gallery.config.RetentionProperties;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.domain.GalleryExpiryState;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The arithmetic and the guard rails around gallery retention — the parts that
 * need no database to be wrong.
 *
 * <p>Lives in the service's own package so it can reach {@code daysUntil}
 * directly. That helper decides which warning a client is told about their
 * wedding photos, so it is worth testing at the boundary rather than only
 * through the three phases that call it.
 */
class RetentionRulesTest {

    private static final OffsetDateTime NOW =
        OffsetDateTime.of(2026, 8, 22, 3, 0, 0, 0, ZoneOffset.UTC);

    // ── how many days are left ──────────────────────────────────────────

    /**
     * Rounded up, deliberately. With truncation a gallery expiring in 30 hours
     * reports "1 day" and gets its final warning a day early, while one
     * expiring in 20 hours reports 0 — telling a client their wedding photos
     * vanish today when they actually have until tomorrow.
     */
    @Test
    void partialDaysRoundUpSoNobodyIsToldTheirPhotosGoSooner() {
        assertThat(GalleryRetentionService.daysUntil(NOW, NOW.plusHours(30))).isEqualTo(2);
        assertThat(GalleryRetentionService.daysUntil(NOW, NOW.plusHours(20))).isEqualTo(1);
        assertThat(GalleryRetentionService.daysUntil(NOW, NOW.plusMinutes(1))).isEqualTo(1);
    }

    @Test
    void wholeDaysAreNotInflated() {
        assertThat(GalleryRetentionService.daysUntil(NOW, NOW.plusDays(5))).isEqualTo(5);
        assertThat(GalleryRetentionService.daysUntil(NOW, NOW.plusDays(60))).isEqualTo(60);
    }

    @Test
    void anAlreadyPassedDeadlineIsZeroDaysNotNegative() {
        assertThat(GalleryRetentionService.daysUntil(NOW, NOW)).isZero();
        assertThat(GalleryRetentionService.daysUntil(NOW, NOW.minusDays(3))).isZero();
    }

    /**
     * No deadline means "never expires", and it has to sort as the furthest
     * possible future — a gallery with no window must never be picked up as
     * the most urgent thing to delete.
     */
    @Test
    void aGalleryWithNoDeadlineIsInfinitelyFarFromExpiry() {
        assertThat(GalleryRetentionService.daysUntil(NOW, null)).isEqualTo(Long.MAX_VALUE);
    }

    // ── reachability ────────────────────────────────────────────────────

    @Test
    void aLiveGalleryIsReachable() {
        assertThat(gallery(NOW.minusDays(10), 60).isReachable(NOW)).isTrue();
    }

    /**
     * The sweep runs nightly, so a gallery can be past its date while its row
     * still says ACTIVE. Trusting the state alone would serve photos for up to
     * a day past the window the plan sold.
     */
    @Test
    void aGalleryPastItsDateIsUnreachableEvenWhileStillMarkedActive() {
        Gallery lapsed = gallery(NOW.minusDays(61), 60);

        assertThat(lapsed.getExpiryState()).isEqualTo(GalleryExpiryState.ACTIVE);
        assertThat(lapsed.isReachable(NOW)).isFalse();
    }

    @Test
    void expiryIsDerivedFromTheWindowNeverSuppliedByACaller() {
        assertThat(gallery(NOW, 365).getExpiresAt()).isEqualTo(NOW.plusDays(365));
        assertThat(gallery(NOW, 730).getExpiresAt()).isEqualTo(NOW.plusDays(730));
    }

    // ── recovery ────────────────────────────────────────────────────────

    @Test
    void anExpiredGalleryCanStillBeBroughtBackButAPurgedOneCannot() {
        Gallery expired = gallery(NOW.minusDays(61), 60);
        expired.markExpired(NOW, 30);
        assertThat(expired.canExtend()).isTrue();

        expired.markPurged(NOW);
        assertThat(expired.canExtend()).isFalse();
    }

    @Test
    void extendingClearsTheScheduledDestruction() {
        Gallery gallery = gallery(NOW.minusDays(61), 60);
        gallery.markExpired(NOW, 30);
        assertThat(gallery.getPurgeAfter()).isEqualTo(NOW.plusDays(30));

        gallery.extend(NOW, 60);

        assertThat(gallery.getExpiryState()).isEqualTo(GalleryExpiryState.ACTIVE);
        assertThat(gallery.getPurgeAfter()).isNull();
        assertThat(gallery.getSoftDeletedAt()).isNull();
        assertThat(gallery.getExpiresAt()).isEqualTo(NOW.plusDays(60));
    }

    /**
     * The downgrade case: a gallery delivered on STUDIO (730 days) still has
     * most of its window left when the tenant drops to STARTER (60 days).
     * Extending used to reset the expiry to "now + 60", cutting the gallery by
     * well over a year — and the retention job deletes the photos on that date.
     */
    @Test
    void extendingAfterADowngradeNeverShortensTheExpiry() {
        Gallery gallery = gallery(NOW.minusDays(30), 730);
        OffsetDateTime before = gallery.getExpiresAt();

        boolean changed = gallery.extend(NOW, 60);

        assertThat(gallery.getExpiresAt()).isEqualTo(before);
        assertThat(gallery.getRetentionDays()).isEqualTo(730);
        assertThat(gallery.getExpiryState()).isEqualTo(GalleryExpiryState.ACTIVE);
        // Nothing happened, so nothing goes into the history or the audit log.
        assertThat(changed).isFalse();
        assertThat(gallery.getExtensionCount()).isZero();
        assertThat(gallery.getExtendedAt()).isNull();
    }

    @Test
    void extendingAnActiveGalleryRenewsTheFullWindowFromNow() {
        Gallery gallery = gallery(NOW.minusDays(50), 60);

        boolean changed = gallery.extend(NOW, 60);

        assertThat(changed).isTrue();
        assertThat(gallery.getExpiresAt()).isEqualTo(NOW.plusDays(60));
        assertThat(gallery.getExtensionCount()).isEqualTo(1);
    }

    /** "No expiry" is later than any plan window, so extending keeps it. */
    @Test
    void extendingAGalleryWithoutAnExpiryLeavesItUnlimited() {
        Gallery gallery = gallery(NOW.minusDays(50), 60);
        gallery.setExpiresAt(null);

        assertThat(gallery.extend(NOW, 60)).isFalse();
        assertThat(gallery.getExpiresAt()).isNull();
    }

    // ── configuration guards ────────────────────────────────────────────

    /**
     * A zero-day grace period collapses "loses access" and "is destroyed" into
     * one event, removing the margin ADR-001 §4.3 requires for our own bugs.
     */
    @Test
    void bootFailsOnAZeroDayGracePeriod() {
        RetentionProperties props = new RetentionProperties();
        props.setGraceDays(0);

        assertThatThrownBy(props::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("grace-days");
    }

    /**
     * No thresholds means galleries expire with the client never warned —
     * exactly the silent vanishing ADR-001 §4.1 forbids.
     */
    @Test
    void bootFailsWithNoReminderThresholds() {
        RetentionProperties props = new RetentionProperties();
        props.setReminderDaysBefore(List.of());

        assertThatThrownBy(props::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("reminder-days-before");
    }

    @Test
    void thresholdsAreOrderedMostUrgentFirst() {
        RetentionProperties props = new RetentionProperties();
        props.setReminderDaysBefore(List.of(5, 15, 1));

        assertThat(props.sortedThresholds()).containsExactly(1, 5, 15);
    }

    /**
     * The destructive phase stays off unless an environment opts in — ADR-001
     * §4.4 gates the first deletion on the AGB wording, and a staging database
     * restored from production must not start deleting on its first night.
     */
    @Test
    void purgingIsOffUnlessExplicitlyEnabled() {
        assertThat(new RetentionProperties().isPurgeEnabled()).isFalse();
    }

    @Test
    void defaultsMatchTheAdr() {
        RetentionProperties props = new RetentionProperties();
        assertThat(props.getReminderDaysBefore()).containsExactly(15, 5, 1);
        assertThat(props.getGraceDays()).isEqualTo(30);
        assertThat(props.isEnabled()).isTrue();
    }

    private static Gallery gallery(OffsetDateTime deliveredAt, int retentionDays) {
        return new Gallery(UUID.randomUUID(), deliveredAt, retentionDays, true, false);
    }
}
