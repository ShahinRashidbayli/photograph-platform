package com.photographplatform.api.analytics.service;

import com.photographplatform.api.analytics.dto.AnalyticsResponse;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.BookingSummary;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.MonthlyAmount;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.MonthlyCount;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.PackageCount;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.PhotographerCount;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.RevenueSummary;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.StatusCount;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.BusinessZone;
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
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
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
 * <p>This is <em>not</em> the convention elsewhere, contrary to what an earlier
 * version of this comment claimed: the repositories over RLS-protected tables
 * carry no tenant predicate at all and rely on the policy alone, which is a
 * coherent choice — the integration suite connects as {@code fotolio_app}, so
 * RLS is genuinely exercised there. The belt-and-braces here is kept because
 * these are hand-written aggregates rather than derived queries, and because
 * this screen is the one that reads a tenant's entire financial history.
 */
@Service
public class AnalyticsService {

    /**
     * Bound as a list parameter, so the queries below take Billable from
     * {@link BookingStatus#BILLABLE} instead of spelling their own list.
     */
    private static final List<String> BILLABLE = BookingStatus.namesOf(BookingStatus.BILLABLE);

    private final JdbcTemplate jdbc;
    /** Same connection; only for the queries that bind a status list. */
    private final NamedParameterJdbcTemplate namedJdbc;
    private final EntitlementService entitlementService;
    private final Clock clock;

    public AnalyticsService(JdbcTemplate jdbc, EntitlementService entitlementService, Clock clock) {
        this.jdbc = jdbc;
        this.namedJdbc = new NamedParameterJdbcTemplate(jdbc);
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
                SELECT EXTRACT(YEAR FROM issued_at AT TIME ZONE ?)::int AS y FROM invoices WHERE tenant_id = ?
                UNION ALL
                SELECT EXTRACT(YEAR FROM event_date)::int AS y FROM bookings WHERE tenant_id = ?
            ) t
            WHERE y IS NOT NULL
            ORDER BY y DESC
            """, Integer.class, BusinessZone.ID.getId(), tenantId, tenantId);
    }

    /**
     * Invoiced counts every issued document the way the DATEV export books it
     * (ADR-004 §3): a Storniert original stays +X in its own month and its
     * Storno is −X in the Storno's month. Counting only the rows still marked
     * ISSUED kept the Storno and dropped the original, so a reversed sale
     * showed as −X, and the report stopped matching what the accountant gets.
     *
     * <p>Months and years are Europe/Berlin, the zone the DATEV Belegdatum is
     * taken in (see InvoiceDate). EXTRACT on a timestamptz otherwise uses the
     * session's zone, which is UTC in a container: an invoice issued at 00:30
     * on the 1st landed in the month before.
     *
     * <p>Collected still follows the invoice's month here, not yet the month the
     * payment succeeded that ADR-004 §3 asks for. Because the Storniert
     * originals are in the rows, money paid on one counts as Collected: it did
     * arrive.
     */
    private RevenueSummary revenue(UUID tenantId, int year) {
        // The count and the average are of Live invoices only. A Storno and the
        // invoice it withdrew are one correction, not two more sales.
        Map<String, Object> totals = jdbc.queryForMap("""
            SELECT
                COALESCE(SUM(i.total_cents), 0)                       AS invoiced,
                COUNT(*) FILTER (WHERE i.status = 'ISSUED' AND i.storno_of_id IS NULL) AS live_count,
                COALESCE(SUM(i.total_cents)
                    FILTER (WHERE i.status = 'ISSUED' AND i.storno_of_id IS NULL), 0)  AS live_total,
                COALESCE(SUM(paid.amount), 0)                         AS collected
            FROM invoices i
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(p.amount_cents), 0) AS amount
                FROM payments p
                WHERE p.invoice_id = i.id AND p.status = 'SUCCEEDED' AND p.tenant_id = ?
            ) paid ON TRUE
            WHERE i.tenant_id = ?
              AND EXTRACT(YEAR FROM i.issued_at AT TIME ZONE ?) = ?
            """, tenantId, tenantId, BusinessZone.ID.getId(), year);

        long invoiced = num(totals.get("invoiced"));
        long collected = num(totals.get("collected"));
        int count = (int) num(totals.get("live_count"));
        long liveTotal = num(totals.get("live_total"));

        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT
                EXTRACT(MONTH FROM i.issued_at AT TIME ZONE ?)::int AS m,
                COALESCE(SUM(i.total_cents), 0)      AS invoiced,
                COALESCE(SUM(paid.amount), 0)        AS collected
            FROM invoices i
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(p.amount_cents), 0) AS amount
                FROM payments p
                WHERE p.invoice_id = i.id AND p.status = 'SUCCEEDED' AND p.tenant_id = ?
            ) paid ON TRUE
            WHERE i.tenant_id = ?
              AND EXTRACT(YEAR FROM i.issued_at AT TIME ZONE ?) = ?
            GROUP BY 1
            """, BusinessZone.ID.getId(), tenantId, tenantId, BusinessZone.ID.getId(), year);

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
            count == 0 ? 0 : liveTotal / count,
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

        // Only Billable bookings count in the package mix: the question this
        // answers is "what sells", and neither an enquiry nobody has agreed to
        // nor a package someone backed out of has sold.
        Map<String, Object> billableInYear = Map.of("tenantId", tenantId, "year", year, "billable", BILLABLE);
        List<PackageCount> topPackages = namedJdbc.queryForList("""
            SELECT COALESCE(p.name, '—')                    AS name,
                   COUNT(*)                                 AS cnt,
                   COALESCE(SUM(b.total_amount_cents), 0)   AS revenue
            FROM bookings b
            LEFT JOIN packages p ON p.id = b.package_id AND p.tenant_id = b.tenant_id
            WHERE b.tenant_id = :tenantId
              AND EXTRACT(YEAR FROM b.event_date) = :year
              AND b.status IN (:billable)
            GROUP BY 1
            ORDER BY cnt DESC, revenue DESC
            LIMIT 5
            """, billableInYear).stream()
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

        // Only Billable bookings, for the same reason as the package mix: this
        // answers "who did the work", and work that was never agreed or was
        // backed out of was not done. Unassigned bookings keep their own row so
        // the split still reconciles against the year.
        List<PhotographerCount> byPhotographer = namedJdbc.queryForList("""
            SELECT u.full_name                              AS name,
                   u.email                                  AS email,
                   COUNT(*)                                 AS cnt,
                   COALESCE(SUM(b.total_amount_cents), 0)   AS revenue
            FROM bookings b
            LEFT JOIN users u ON u.id = b.assigned_user_id AND u.tenant_id = b.tenant_id
            WHERE b.tenant_id = :tenantId
              AND EXTRACT(YEAR FROM b.event_date) = :year
              AND b.status IN (:billable)
            GROUP BY u.full_name, u.email
            ORDER BY cnt DESC, revenue DESC
            """, billableInYear).stream()
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
