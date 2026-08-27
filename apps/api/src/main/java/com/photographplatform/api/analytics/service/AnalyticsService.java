package com.photographplatform.api.analytics.service;

import com.photographplatform.api.analytics.dto.AnalyticsResponse;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.BookingSummary;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.MonthlyAmount;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.MonthlyCount;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.PackageCount;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.PhotographerCount;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.RevenueSummary;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.StatusCount;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.service.EntitlementService;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The studio's own numbers, for one fiscal year.
 *
 * <p>Plan-gated on {@link Capability#ANALYTICS}. The gate is the first thing
 * this does, because everything after it reads the whole tenant's history.
 *
 * <p>Written as aggregate SQL rather than by loading entities and summing them
 * in Java. A studio with three years of bookings is a few thousand rows, which
 * is small enough that either would work today and large enough that the
 * loading version would quietly become the slowest screen in the product.
 *
 * <h2>Every query filters on tenant_id explicitly</h2>
 * Not because RLS is absent — V11's policies cover these tables — but because
 * RLS is the second lock, not the only one. It is bypassed for any role with
 * BYPASSRLS, which is exactly what a local `DB_USERNAME=postgres` is: written
 * against RLS alone, this screen showed a brand-new studio five years of other
 * tenants' history on a developer machine, and would have kept doing so on any
 * environment that connects as an owning role.
 *
 * <p>Every JPA repository in this codebase already carries the same explicit
 * predicate. These follow that convention rather than inventing a weaker one.
 */
@Service
public class AnalyticsService {

    private final JdbcTemplate jdbc;
    private final EntitlementService entitlementService;
    private final Clock clock;

    public AnalyticsService(JdbcTemplate jdbc, EntitlementService entitlementService, Clock clock) {
        this.jdbc = jdbc;
        this.entitlementService = entitlementService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AnalyticsResponse forYear(Integer requestedYear) {
        entitlementService.requireCapabilityForCurrentTenant(Capability.ANALYTICS);

        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        List<Integer> years = availableYears(tenantId);
        int year = requestedYear != null
            ? requestedYear
            // Default to the most recent year with anything in it, not to the
            // calendar year: opening the screen on 2 January to an empty page
            // reads as a broken report rather than as a new year.
            : years.isEmpty() ? LocalDate.now(clock).getYear() : years.get(0);

        return new AnalyticsResponse(year, years, revenue(tenantId, year), bookings(tenantId, year));
    }

    /** Years the studio has invoices or bookings in, newest first. */
    private List<Integer> availableYears(UUID tenantId) {
        return jdbc.queryForList("""
            SELECT DISTINCT y FROM (
                SELECT EXTRACT(YEAR FROM issued_at)::int  AS y FROM invoices WHERE tenant_id = ?
                UNION ALL
                SELECT EXTRACT(YEAR FROM event_date)::int AS y FROM bookings WHERE tenant_id = ?
            ) t
            WHERE y IS NOT NULL
            ORDER BY y DESC
            """, Integer.class, tenantId, tenantId);
    }

    private RevenueSummary revenue(UUID tenantId, int year) {
        // Cancelled invoices and their storno documents both sit in the table —
        // GoBD forbids deleting either — so counting every row would show the
        // sale twice and then show revenue that was reversed. ISSUED only.
        Map<String, Object> totals = jdbc.queryForMap("""
            SELECT
                COALESCE(SUM(i.total_cents), 0)                       AS invoiced,
                COUNT(*)                                              AS cnt,
                COALESCE(SUM(paid.amount), 0)                         AS collected
            FROM invoices i
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(p.amount_cents), 0) AS amount
                FROM payments p
                WHERE p.invoice_id = i.id AND p.status = 'SUCCEEDED' AND p.tenant_id = ?
            ) paid ON TRUE
            WHERE i.tenant_id = ?
              AND i.status = 'ISSUED'
              AND EXTRACT(YEAR FROM i.issued_at) = ?
            """, tenantId, tenantId, year);

        long invoiced = num(totals.get("invoiced"));
        long collected = num(totals.get("collected"));
        int count = (int) num(totals.get("cnt"));

        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT
                EXTRACT(MONTH FROM i.issued_at)::int AS m,
                COALESCE(SUM(i.total_cents), 0)      AS invoiced,
                COALESCE(SUM(paid.amount), 0)        AS collected
            FROM invoices i
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(p.amount_cents), 0) AS amount
                FROM payments p
                WHERE p.invoice_id = i.id AND p.status = 'SUCCEEDED' AND p.tenant_id = ?
            ) paid ON TRUE
            WHERE i.tenant_id = ?
              AND i.status = 'ISSUED'
              AND EXTRACT(YEAR FROM i.issued_at) = ?
            GROUP BY 1
            """, tenantId, tenantId, year);

        Map<Integer, MonthlyAmount> byMonth = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            int m = (int) num(r.get("m"));
            byMonth.put(m, new MonthlyAmount(m, num(r.get("invoiced")), num(r.get("collected"))));
        }
        List<MonthlyAmount> months = new ArrayList<>(12);
        for (int m = 1; m <= 12; m++) {
            months.add(byMonth.getOrDefault(m, new MonthlyAmount(m, 0, 0)));
        }

        return new RevenueSummary(
            invoiced,
            collected,
            // Clamped: an overpayment (a client paying a rounded-up amount) would
            // otherwise render as negative money owed.
            Math.max(0, invoiced - collected),
            count,
            count == 0 ? 0 : invoiced / count,
            months);
    }

    private BookingSummary bookings(UUID tenantId, int year) {
        List<Map<String, Object>> statusRows = jdbc.queryForList("""
            SELECT status, COUNT(*) AS cnt
            FROM bookings
            WHERE tenant_id = ? AND EXTRACT(YEAR FROM event_date) = ?
            GROUP BY status
            ORDER BY cnt DESC
            """, tenantId, year);
        List<StatusCount> byStatus = statusRows.stream()
            .map(r -> new StatusCount((String) r.get("status"), (int) num(r.get("cnt"))))
            .toList();
        int total = byStatus.stream().mapToInt(StatusCount::count).sum();

        List<Map<String, Object>> monthRows = jdbc.queryForList("""
            SELECT EXTRACT(MONTH FROM event_date)::int AS m, COUNT(*) AS cnt
            FROM bookings
            WHERE tenant_id = ? AND EXTRACT(YEAR FROM event_date) = ?
            GROUP BY 1
            """, tenantId, year);
        Map<Integer, Integer> counts = new LinkedHashMap<>();
        for (Map<String, Object> r : monthRows) {
            counts.put((int) num(r.get("m")), (int) num(r.get("cnt")));
        }
        List<MonthlyCount> months = new ArrayList<>(12);
        for (int m = 1; m <= 12; m++) {
            months.add(new MonthlyCount(m, counts.getOrDefault(m, 0)));
        }

        // Cancelled and declined bookings are left out of the package mix: the
        // question this answers is "what sells", and a package someone backed
        // out of did not.
        List<PackageCount> topPackages = jdbc.queryForList("""
            SELECT COALESCE(p.name, '—')                    AS name,
                   COUNT(*)                                 AS cnt,
                   COALESCE(SUM(b.total_amount_cents), 0)   AS revenue
            FROM bookings b
            LEFT JOIN packages p ON p.id = b.package_id AND p.tenant_id = b.tenant_id
            WHERE b.tenant_id = ?
              AND EXTRACT(YEAR FROM b.event_date) = ?
              AND b.status NOT IN ('CANCELLED', 'DECLINED')
            GROUP BY 1
            ORDER BY cnt DESC, revenue DESC
            LIMIT 5
            """, tenantId, year).stream()
            .map(r -> new PackageCount(
                (String) r.get("name"), (int) num(r.get("cnt")), num(r.get("revenue"))))
            .toList();

        // COUNT never returns NULL, but queryForObject's signature is nullable
        // and unboxing it directly is an NPE waiting for a schema change.
        int leadsReceived = (int) num(jdbc.queryForObject("""
            SELECT COUNT(*) FROM leads
            WHERE tenant_id = ? AND EXTRACT(YEAR FROM created_at) = ?
            """, Long.class, tenantId, year));
        // Through the foreign key, not by matching addresses: the same person
        // may enquire twice, and counting emails would credit one booking to
        // both enquiries.
        int leadsConverted = (int) num(jdbc.queryForObject("""
            SELECT COUNT(DISTINCT l.id)
            FROM leads l
            JOIN bookings b ON b.lead_id = l.id AND b.tenant_id = l.tenant_id
            WHERE l.tenant_id = ? AND EXTRACT(YEAR FROM l.created_at) = ?
            """, Long.class, tenantId, year));

        // Cancelled and declined are left out for the same reason as the package
        // mix: this answers "who did the work", and work somebody backed out of
        // was not done. Unassigned bookings keep their own row so the split
        // still reconciles against the year.
        List<PhotographerCount> byPhotographer = jdbc.queryForList("""
            SELECT u.full_name                              AS name,
                   u.email                                  AS email,
                   COUNT(*)                                 AS cnt,
                   COALESCE(SUM(b.total_amount_cents), 0)   AS revenue
            FROM bookings b
            LEFT JOIN users u ON u.id = b.assigned_user_id AND u.tenant_id = b.tenant_id
            WHERE b.tenant_id = ?
              AND EXTRACT(YEAR FROM b.event_date) = ?
              AND b.status NOT IN ('CANCELLED', 'DECLINED')
            GROUP BY u.full_name, u.email
            ORDER BY cnt DESC, revenue DESC
            """, tenantId, year).stream()
            .map(r -> {
                String name = (String) r.get("name");
                if (name == null || name.isBlank()) {
                    name = (String) r.get("email");
                }
                return new PhotographerCount(name, (int) num(r.get("cnt")), num(r.get("revenue")));
            })
            .toList();

        return new BookingSummary(
            total, byStatus, months, topPackages, leadsReceived, leadsConverted, byPhotographer);
    }

    /** Postgres hands back Long, Integer or BigDecimal depending on the aggregate. */
    private static long num(Object value) {
        return value == null ? 0L : ((Number) value).longValue();
    }
}
