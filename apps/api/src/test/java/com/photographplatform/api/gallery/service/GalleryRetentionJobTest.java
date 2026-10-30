package com.photographplatform.api.gallery.service;

import com.photographplatform.api.common.scheduling.JobLock;
import com.photographplatform.api.common.scheduling.TenantJobRunner;
import com.photographplatform.api.gallery.config.RetentionProperties;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The seam between the scheduling infrastructure and the retention rules.
 *
 * <p>Small surface, but the two things it owns are both load-bearing: the
 * lease that stops two replicas purging concurrently, and the order the phases
 * run in. Neither is visible from the service's own tests.
 */
class GalleryRetentionJobTest {

    private JobLock jobLock;
    private TenantJobRunner tenantJobRunner;
    private GalleryRetentionService retention;
    private RetentionProperties properties;
    private GalleryRetentionJob job;

    @BeforeEach
    void setUp() {
        jobLock = mock(JobLock.class);
        tenantJobRunner = mock(TenantJobRunner.class);
        retention = mock(GalleryRetentionService.class);
        properties = new RetentionProperties();
        job = new GalleryRetentionJob(jobLock, tenantJobRunner, retention, properties);

        when(tenantJobRunner.forEachTenant(anyString(), any()))
            .thenReturn(new TenantJobRunner.Result(0, 0, 0));
        // Default: this instance wins the lease and the work runs.
        doAnswer(invocation -> {
            invocation.getArgument(2, Runnable.class).run();
            return true;
        }).when(jobLock).runIfLeased(anyString(), any(Duration.class), any(Runnable.class));
    }

    @Test
    void aDisabledJobNeverEvenTakesTheLease() {
        properties.setEnabled(false);

        job.run();

        verifyNoInteractions(jobLock);
        verifyNoInteractions(tenantJobRunner);
    }

    @Test
    void theSweepRunsUnderALease() {
        job.run();

        verify(jobLock).runIfLeased(eq("gallery-retention"), any(Duration.class), any(Runnable.class));
        verify(tenantJobRunner, times(3)).forEachTenant(anyString(), any());
    }

    /**
     * Losing the lease must mean doing nothing at all — that is the entire
     * protection against two replicas purging the same galleries.
     */
    @Test
    void losingTheLeaseSkipsEveryPhase() {
        when(jobLock.runIfLeased(anyString(), any(Duration.class), any(Runnable.class)))
            .thenReturn(false);

        job.run();

        verifyNoInteractions(tenantJobRunner);
    }

    /**
     * Warn → expire → purge, and not in any other order.
     *
     * <p>Warnings first so a gallery crossing its final threshold tonight is
     * warned rather than silently switched off; expiry before purge so nothing
     * can be created and destroyed inside a single sweep.
     */
    @Test
    void phasesRunWarnThenExpireThenPurge() {
        ArgumentCaptor<String> phases = ArgumentCaptor.forClass(String.class);

        job.sweep();

        verify(tenantJobRunner, times(3)).forEachTenant(phases.capture(), any());
        assertThat(phases.getAllValues()).containsExactly(
            "gallery-retention:remind",
            "gallery-retention:expire",
            "gallery-retention:purge");
    }

    /**
     * The lease must comfortably outlast the sweep: if it expires mid-run, a
     * second instance can start purging the same rows.
     */
    @Test
    void theLeaseIsLongerThanAnyPlausibleSweep() {
        ArgumentCaptor<Duration> lease = ArgumentCaptor.forClass(Duration.class);

        job.run();

        verify(jobLock).runIfLeased(anyString(), lease.capture(), any());
        assertThat(lease.getValue()).isGreaterThanOrEqualTo(Duration.ofHours(1));
    }

    @Test
    void everyPhaseIsDelegatedToTheRetentionRules() {
        List<String> invoked = new ArrayList<>();
        when(tenantJobRunner.forEachTenant(anyString(), any())).thenAnswer(invocation -> {
            invoked.add(invocation.getArgument(0));
            return new TenantJobRunner.Result(1, 1, 0);
        });

        job.sweep();

        assertThat(invoked).hasSize(3);
        // The job itself must not touch galleries — every decision about what
        // may be deleted belongs to the service, where it is unit-testable
        // against a fixed clock.
        verify(retention, never()).purgeDue(any());
    }
}
