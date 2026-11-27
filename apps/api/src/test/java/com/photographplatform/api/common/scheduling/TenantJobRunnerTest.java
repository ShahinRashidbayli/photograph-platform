package com.photographplatform.api.common.scheduling;

import com.photographplatform.api.common.logging.LogFields;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.MDC;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The log context a nightly job runs under. The iteration itself — paging,
 * one transaction per tenant, a failure not stopping the sweep — runs against
 * Postgres in the jobs' own ITs.
 */
class TenantJobRunnerTest {

    private final TenantRepository tenantRepository = mock(TenantRepository.class);
    private final PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
    private final TenantJobRunner runner = new TenantJobRunner(tenantRepository, transactionManager);

    private final Tenant anna = tenant("anna-fotografie");
    private final Tenant ben = tenant("ben-weddings");

    @BeforeEach
    void twoTenants() {
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(tenantRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(anna, ben)));
    }

    @AfterEach
    void clearThread() {
        MDC.clear();
    }

    @Test
    void everyLineTheWorkWritesNamesTheJobAndTheTenantItIsFor() {
        List<Map<String, String>> seen = new ArrayList<>();

        runner.forEachTenant("gallery-retention", tenant -> {
            seen.add(MDC.getCopyOfContextMap());
            return 0;
        });

        assertThat(seen).extracting(context -> context.get(LogFields.JOB))
            .containsExactly("gallery-retention", "gallery-retention");
        assertThat(seen).extracting(context -> context.get(LogFields.TENANT_ID))
            .containsExactly(anna.getId().toString(), ben.getId().toString());
        assertThat(MDC.getCopyOfContextMap()).as("left on the scheduler's pooled thread").isNullOrEmpty();
    }

    /** A solo photographer's subdomain is usually their own name. */
    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void aFailedTenantIsLoggedByIdNeverBySubdomain(CapturedOutput log) {
        TenantJobRunner.Result result = runner.forEachTenant("gallery-retention", tenant -> {
            if (tenant == anna) {
                throw new IllegalStateException("boom");
            }
            return 1;
        });

        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.processed()).isEqualTo(1);
        assertThat(log.getAll()).contains("Job 'gallery-retention' failed for this tenant")
            .doesNotContain("anna-fotografie");
    }

    private static Tenant tenant(String subdomain) {
        Tenant tenant = new Tenant(subdomain, subdomain + "@example.test");
        ReflectionTestUtils.setField(tenant, "id", UUID.randomUUID());
        return tenant;
    }
}
