package com.photographplatform.api.analytics;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.analytics.dto.AnalyticsResponse;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.PackageCount;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.PhotographerCount;
import com.photographplatform.api.analytics.service.AnalyticsService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The studio's yearly report against a real Postgres.
 *
 * <p>The package mix and the per-photographer split both add up quoted booking
 * totals, which makes them Booked figures: only Billable bookings belong in
 * them (GLOSSARY.md). They used to leave out only cancelled and declined ones,
 * so an enquiry nobody had agreed to yet counted as a package sold.
 */
class AnalyticsServiceIT extends IntegrationTestBase {

    private static final int YEAR = 2025;

    @Autowired private AnalyticsService analyticsService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private PlatformTransactionManager txManager;

    @Test
    void onlyBillableBookingsCountInThePackageMixAndPhotographerSplit() {
        Fixture fx = createStudio();
        createBooking(fx, "CONFIRMED", 100_000);
        createBooking(fx, "ENQUIRY", 50_000);
        createBooking(fx, "CANCELLED", 30_000);

        AnalyticsResponse report = asUser(fx, () -> analyticsService.forYear(YEAR));

        assertThat(report.bookings().topPackages())
            .extracting(PackageCount::count, PackageCount::revenueCents)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(1, 100_000L));
        assertThat(report.bookings().byPhotographer())
            .extracting(PhotographerCount::count, PhotographerCount::revenueCents)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(1, 100_000L));
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    private record Fixture(UUID tenantId, UUID userId) {
    }

    /** On STUDIO, because the report is gated on the analytics capability. */
    private Fixture createStudio() {
        UUID tenantId = new TransactionTemplate(txManager).execute(status -> {
            Tenant tenant = new Tenant("analytics-test-" + UUID.randomUUID(),
                "owner-" + UUID.randomUUID() + "@example.test");
            tenant.setPlan(Plan.STUDIO);
            return tenantRepository.save(tenant).getId();
        });
        UUID userId = asTenant(tenantId, () -> userRepository.save(
            new User(tenantId, "photographer-" + UUID.randomUUID() + "@example.test", "hash", "Anna")).getId());
        return new Fixture(tenantId, userId);
    }

    private void createBooking(Fixture fx, String status, int totalAmountCents) {
        asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager).execute(tx -> {
            entityManager.createNativeQuery("""
                INSERT INTO bookings (tenant_id, client_name, client_email, event_date, status, total_amount_cents)
                VALUES (:tenantId, 'Maria Kellner', 'maria@example.test', :eventDate, :status, :total)
                """)
                .setParameter("tenantId", fx.tenantId())
                .setParameter("eventDate", LocalDate.of(YEAR, 6, 14))
                .setParameter("status", status)
                .setParameter("total", totalAmountCents)
                .executeUpdate();
            return null;
        }));
    }

    private <T> T asUser(Fixture fx, Supplier<T> action) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(fx.userId().toString(), null));
        TenantContext.setTenant(fx.tenantId().toString());
        try {
            return action.get();
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    private <T> T asTenant(UUID tenantId, Supplier<T> action) {
        TenantContext.setTenant(tenantId.toString());
        try {
            return action.get();
        } finally {
            TenantContext.clear();
        }
    }
}
