package com.photographplatform.api.gallery.service;

import com.photographplatform.api.common.scheduling.JobLock;
import com.photographplatform.api.common.scheduling.TenantJobRunner;
import com.photographplatform.api.gallery.config.RetentionProperties;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs gallery retention once a night: warn, expire, purge.
 *
 * <p>Deliberately thin. It owns the schedule, the lease and the order of the
 * phases; every decision about what may be deleted lives in
 * {@link GalleryRetentionService}, which is where it can be unit-tested
 * against a fixed clock without a scheduler in the picture.
 */
@Component
public class GalleryRetentionJob {

    private static final Logger LOG = LoggerFactory.getLogger(GalleryRetentionJob.class);
    private static final String JOB_NAME = "gallery-retention";

    /**
     * Comfortably longer than the sweep should ever take, because the cost of
     * a lease that expires mid-run is two instances purging concurrently. The
     * job runs daily, so an over-long lease costs nothing: worst case it
     * delays one night's run after a hard crash.
     */
    private static final Duration LEASE = Duration.ofHours(2);

    private final JobLock jobLock;
    private final TenantJobRunner tenantJobRunner;
    private final GalleryRetentionService retention;
    private final RetentionProperties properties;

    public GalleryRetentionJob(
        JobLock jobLock,
        TenantJobRunner tenantJobRunner,
        GalleryRetentionService retention,
        RetentionProperties properties) {
        this.jobLock = jobLock;
        this.tenantJobRunner = tenantJobRunner;
        this.retention = retention;
        this.properties = properties;
    }

    @Scheduled(cron = "${app.retention.cron:0 0 3 * * *}", zone = "Europe/Berlin")
    public void run() {
        if (!properties.isEnabled()) {
            return;
        }
        jobLock.runIfLeased(JOB_NAME, LEASE, this::sweep);
    }

    /**
     * Package-private so tests can drive the sweep directly, without a
     * scheduler and without competing for the lease.
     */
    void sweep() {
        // Phase order is not arbitrary. Warnings run before expiry so a
        // gallery crossing its last threshold on the same night is warned
        // rather than silently switched off; expiry runs before purge so
        // nothing can be created and destroyed within one sweep.
        TenantJobRunner.Result warned =
            tenantJobRunner.forEachTenant(JOB_NAME + ":remind", retention::sendDueReminders);
        TenantJobRunner.Result expired =
            tenantJobRunner.forEachTenant(JOB_NAME + ":expire", retention::expireDue);
        TenantJobRunner.Result purged =
            tenantJobRunner.forEachTenant(JOB_NAME + ":purge", retention::purgeDue);

        // Logged unconditionally when anything happened, and at INFO: this is
        // the only record that a destructive job ran and what it touched. A
        // quiet night stays quiet so the line is worth reading when it appears.
        if (warned.didWork() || expired.didWork() || purged.didWork()) {
            LOG.info(
                "Gallery retention swept {} tenants: {} warned, {} expired, {} purged "
                    + "(failures: {} warn / {} expire / {} purge)",
                warned.tenants(), warned.processed(), expired.processed(), purged.processed(),
                warned.failed(), expired.failed(), purged.failed());
        }
    }
}
