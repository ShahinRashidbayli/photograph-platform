package com.photographplatform.api.analytics;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.analytics.dto.AnalyticsResponse;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.PackageCount;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.PhotographerCount;
import com.photographplatform.api.analytics.dto.AnalyticsResponse.RevenueSummary;
import com.photographplatform.api.analytics.dto.YearSummaryResponse;
import com.photographplatform.api.analytics.service.AnalyticsService;
import com.photographplatform.api.analytics.service.YearSummaryService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.service.BookingQueryService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.PlanUpgradeRequiredException;
import com.photographplatform.api.invoice.service.InvoiceService;
import com.photographplatform.api.invoice.service.SettlementPeriods;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.persistence.EntityManager;
import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
    /** Spelled out rather than taken from the code under test: the spec says Berlin. */
    private static final ZoneId BERLIN = ZoneId.of("Europe/Berlin");

    @Autowired private AnalyticsService analyticsService;
    @Autowired private InvoiceService invoiceService;
    @Autowired private BookingQueryService bookingQueryService;
    @Autowired private SettlementPeriods settlementPeriods;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private PlatformTransactionManager txManager;
    @Autowired private JdbcTemplate jdbc;

    /** Unique per (tenant, issue year) is all the schema asks; one counter for the test is enough. */
    private int nextSequenceNumber = 1;

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

    /**
     * A Storno withdraws its original, and the two net to zero (GLOSSARY.md).
     * Counting only the documents still marked ISSUED left the original out and
     * kept the Storno, so a reversed sale showed as negative money.
     */
    @Test
    void aStornoInTheSameMonthLeavesThatMonthAtZero() {
        Fixture fx = createStudio();
        UUID sale = issueInvoice(fx, 150_000, berlin(YEAR, 6, 3, 11, 0));
        storno(fx, sale, berlin(YEAR, 6, 24, 16, 0));

        RevenueSummary revenue = report(fx).revenue();

        assertThat(invoicedIn(revenue, 6)).isZero();
        assertThat(revenue.invoicedCents()).isZero();
    }

    /**
     * ADR-004 §3, the way DATEV books it: the original stays +X in its own
     * month after it is Storniert, and the correction shows up in the month it
     * was made.
     */
    @Test
    void aStornoInALaterMonthCountsInItsOwnMonth() {
        Fixture fx = createStudio();
        UUID march = issueInvoice(fx, 150_000, berlin(YEAR, 3, 10, 14, 0));
        storno(fx, march, berlin(YEAR, 4, 2, 9, 0));

        RevenueSummary revenue = report(fx).revenue();

        assertThat(invoicedIn(revenue, 3)).isEqualTo(150_000L);
        assertThat(invoicedIn(revenue, 4)).isEqualTo(-150_000L);
        assertThat(revenue.invoicedCents()).isZero();
    }

    /**
     * 00:30 on 1 April in Berlin is 22:30 on 31 March in UTC. The DATEV
     * Belegdatum is the Berlin date, so the report has to agree with it.
     */
    @Test
    void anInvoiceIssuedJustAfterMidnightOnTheFirstCountsInThatMonth() {
        Fixture fx = createStudio();
        issueInvoice(fx, 120_000, berlin(YEAR, 4, 1, 0, 30));

        RevenueSummary revenue = report(fx).revenue();

        assertThat(invoicedIn(revenue, 3)).isZero();
        assertThat(invoicedIn(revenue, 4)).isEqualTo(120_000L);
    }

    /**
     * The figure a studio sees and the file its accountant receives must not
     * disagree. The year's edges are where they would: an invoice at 00:30 on
     * 1 January is this year's in Berlin and last year's in UTC.
     */
    @Test
    void yearlyTotalsMatchWhatTheDatevExportBooksForTheSameYear() {
        Fixture fx = createStudio();
        issueInvoice(fx, 214_200, berlin(YEAR, 1, 1, 0, 30));
        UUID reversed = issueInvoice(fx, 90_000, berlin(YEAR, 5, 5, 10, 0));
        storno(fx, reversed, berlin(YEAR, 5, 20, 10, 0));
        UUID lastYears = issueInvoice(fx, 50_000, berlin(YEAR - 1, 12, 15, 10, 0));
        storno(fx, lastYears, berlin(YEAR, 2, 3, 10, 0));
        issueInvoice(fx, 33_300, berlin(YEAR, 12, 31, 23, 30));
        issueInvoice(fx, 77_700, berlin(YEAR + 1, 1, 1, 0, 30));

        long invoiced = report(fx).revenue().invoicedCents();

        // 2142.00 + 900.00 − 900.00 − 500.00 + 333.00
        assertThat(invoiced).isEqualTo(197_500L);
        assertThat(invoiced).isEqualTo(datevBookedCents(fx, YEAR));
    }

    /**
     * The average describes a sale that stands. A Storno and the invoice it
     * withdrew are a correction, not two more sales, so the count is of Live
     * invoices (GLOSSARY.md) and one reversed sale does not drag down the
     * average of the real one.
     */
    @Test
    void theAverageInvoiceIsTakenOverLiveInvoicesOnly() {
        Fixture fx = createStudio();
        issueInvoice(fx, 200_000, berlin(YEAR, 7, 1, 10, 0));
        UUID reversed = issueInvoice(fx, 80_000, berlin(YEAR, 7, 2, 10, 0));
        storno(fx, reversed, berlin(YEAR, 7, 3, 10, 0));

        RevenueSummary revenue = report(fx).revenue();

        assertThat(revenue.invoiceCount()).isEqualTo(1);
        assertThat(revenue.averageInvoiceCents()).isEqualTo(200_000L);
    }

    /**
     * ADR-004 §3: Collected is counted when the money arrived, as in an EÜR,
     * not in the month of the invoice it pays. Counting it by invoice month
     * put January money into last year's report.
     */
    @Test
    void aDecemberInvoicePaidInJanuaryIsInvoicedInDecemberAndCollectedInJanuary() {
        Fixture fx = createStudio();
        UUID december = issueInvoice(fx, 180_000, berlin(YEAR, 12, 12, 10, 0));
        pay(fx, december, 180_000, berlin(YEAR + 1, 1, 8, 9, 0));

        AnalyticsResponse decembersYear = report(fx, YEAR);
        AnalyticsResponse januarysYear = report(fx, YEAR + 1);

        assertThat(invoicedIn(decembersYear.revenue(), 12)).isEqualTo(180_000L);
        assertThat(collectedIn(decembersYear.revenue(), 12)).isZero();
        assertThat(januarysYear.revenue().invoicedCents()).isZero();
        assertThat(collectedIn(januarysYear.revenue(), 1)).isEqualTo(180_000L);
        // Paid in full, so nothing on December's invoice is still owed, even
        // though its money is in the other year's Collected.
        assertThat(decembersYear.revenue().outstandingCents()).isZero();
        // The year only a payment lives in is still one the picker offers.
        assertThat(decembersYear.availableYears()).containsExactly(YEAR + 1, YEAR);
    }

    /**
     * 00:30 on 1 April in Berlin is 22:30 on 31 March in UTC. The money
     * arrived in April on the studio's calendar, so it is April's Collected.
     */
    @Test
    void aPaymentThatSucceedsJustAfterMidnightOnTheFirstCountsInThatMonth() {
        Fixture fx = createStudio();
        UUID march = issueInvoice(fx, 120_000, berlin(YEAR, 3, 20, 10, 0));
        pay(fx, march, 120_000, berlin(YEAR, 4, 1, 0, 30));

        RevenueSummary revenue = report(fx).revenue();

        assertThat(collectedIn(revenue, 3)).isZero();
        assertThat(collectedIn(revenue, 4)).isEqualTo(120_000L);
    }

    // ── the dashboard's year summary ──────────────────────────────────────

    /**
     * The dashboard tiles are on every plan (ADR-004, Consequences): a STARTER
     * studio, which has no reports, still sees what it Booked, Invoiced and
     * Collected this year.
     */
    @Test
    void theYearSummaryIsOnAPlanWithoutReports() {
        Fixture fx = createStudio(Plan.STARTER);
        createBooking(fx, "CONFIRMED", 100_000);
        UUID march = issueInvoice(fx, 100_000, berlin(YEAR, 3, 2, 10, 0));
        pay(fx, march, 40_000, berlin(YEAR, 3, 9, 10, 0));

        assertThatThrownBy(() -> report(fx)).isInstanceOf(PlanUpgradeRequiredException.class);
        YearSummaryResponse summary = summary(fx);

        assertThat(summary.year()).isEqualTo(YEAR);
        assertThat(summary.bookedCents()).isEqualTo(100_000L);
        assertThat(summary.invoicedCents()).isEqualTo(100_000L);
        assertThat(summary.collectedCents()).isEqualTo(40_000L);
    }

    /**
     * Booked is the quoted value of this year's Billable bookings
     * (GLOSSARY.md). An enquiry has not been agreed and a cancelled or
     * declined shoot will not happen, so neither is money; a shoot on the
     * last day of one year or the first of the next is that year's.
     */
    @Test
    void bookedCountsOnlyBillableBookingsWithAnEventThisYear() {
        Fixture fx = createStudio(Plan.STARTER);
        createBooking(fx, "CONFIRMED", 100_000, LocalDate.of(YEAR, 6, 14));
        createBooking(fx, "POSTPONED", 40_000, LocalDate.of(YEAR, 12, 31));
        createBooking(fx, "COMPLETED", 20_000, LocalDate.of(YEAR, 1, 1));
        createBooking(fx, "ENQUIRY", 50_000, LocalDate.of(YEAR, 6, 14));
        createBooking(fx, "CANCELLED", 30_000, LocalDate.of(YEAR, 6, 14));
        createBooking(fx, "DECLINED", 25_000, LocalDate.of(YEAR, 6, 14));
        createBooking(fx, "COMPLETED", 60_000, LocalDate.of(YEAR - 1, 12, 31));
        createBooking(fx, "CONFIRMED", 70_000, LocalDate.of(YEAR + 1, 1, 1));

        // 1000.00 + 400.00 + 200.00
        assertThat(summary(fx).bookedCents()).isEqualTo(160_000L);
    }

    /**
     * The tile and the report are one figure, not two that happen to agree
     * today: both come from invoice's Settlement periods. A Storno, a payment
     * that arrived this year for last year's invoice, and a part payment are
     * where two separate sums would drift.
     */
    @Test
    void invoicedAndCollectedMatchTheReportForTheYearSoFar() {
        Fixture fx = createStudio();
        UUID lastYears = issueInvoice(fx, 50_000, berlin(YEAR - 1, 12, 15, 10, 0));
        pay(fx, lastYears, 50_000, berlin(YEAR, 1, 5, 9, 0));
        UUID march = issueInvoice(fx, 150_000, berlin(YEAR, 3, 10, 14, 0));
        pay(fx, march, 60_000, berlin(YEAR, 3, 20, 9, 0));
        UUID reversed = issueInvoice(fx, 90_000, berlin(YEAR, 5, 5, 10, 0));
        storno(fx, reversed, berlin(YEAR, 5, 20, 10, 0));

        YearSummaryResponse summary = summary(fx);
        RevenueSummary revenue = report(fx).revenue();

        // 1500.00 + 900.00 − 900.00
        assertThat(summary.invoicedCents()).isEqualTo(150_000L);
        // January's 500.00 for December's invoice, and March's 600.00
        assertThat(summary.collectedCents()).isEqualTo(110_000L);
        assertThat(summary.invoicedCents()).isEqualTo(revenue.invoicedCents());
        assertThat(summary.collectedCents()).isEqualTo(revenue.collectedCents());
    }

    /** Last year's work is not this year's: a new year opens at zero, not empty. */
    @Test
    void aYearWithNothingInItYetIsAllZero() {
        Fixture fx = createStudio(Plan.STARTER);
        createBooking(fx, "CONFIRMED", 80_000, LocalDate.of(YEAR - 1, 9, 1));
        issueInvoice(fx, 80_000, berlin(YEAR - 1, 9, 2, 10, 0));

        YearSummaryResponse summary = summary(fx);

        assertThat(summary.year()).isEqualTo(YEAR);
        assertThat(summary.bookedCents()).isZero();
        assertThat(summary.invoicedCents()).isZero();
        assertThat(summary.collectedCents()).isZero();
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    private record Fixture(UUID tenantId, UUID userId) {
    }

    /** On STUDIO, because the report is gated on the analytics capability. */
    private Fixture createStudio() {
        return createStudio(Plan.STUDIO);
    }

    private Fixture createStudio(Plan plan) {
        UUID tenantId = new TransactionTemplate(txManager).execute(status -> {
            Tenant tenant = new Tenant("analytics-test-" + UUID.randomUUID(),
                "owner-" + UUID.randomUUID() + "@example.test");
            tenant.setPlan(plan);
            return tenantRepository.save(tenant).getId();
        });
        UUID userId = asTenant(tenantId, () -> userRepository.save(
            new User(tenantId, "photographer-" + UUID.randomUUID() + "@example.test", "hash", "Anna")).getId());
        return new Fixture(tenantId, userId);
    }

    private void createBooking(Fixture fx, String status, int totalAmountCents) {
        createBooking(fx, status, totalAmountCents, LocalDate.of(YEAR, 6, 14));
    }

    private void createBooking(Fixture fx, String status, int totalAmountCents, LocalDate eventDate) {
        asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager).execute(tx -> {
            entityManager.createNativeQuery("""
                INSERT INTO bookings (tenant_id, client_name, client_email, event_date, status, total_amount_cents)
                VALUES (:tenantId, 'Maria Kellner', 'maria@example.test', :eventDate, :status, :total)
                """)
                .setParameter("tenantId", fx.tenantId())
                .setParameter("eventDate", eventDate)
                .setParameter("status", status)
                .setParameter("total", totalAmountCents)
                .executeUpdate();
            return null;
        }));
    }

    private static ZonedDateTime berlin(int year, int month, int day, int hour, int minute) {
        return ZonedDateTime.of(year, month, day, hour, minute, 0, 0, BERLIN);
    }

    private static long invoicedIn(RevenueSummary revenue, int month) {
        return revenue.months().get(month - 1).invoicedCents();
    }

    private static long collectedIn(RevenueSummary revenue, int month) {
        return revenue.months().get(month - 1).collectedCents();
    }

    private AnalyticsResponse report(Fixture fx) {
        return report(fx, YEAR);
    }

    /**
     * The report, read over a database session in UTC, the zone a container
     * runs in. The JDBC driver otherwise hands the session the JVM's zone, and
     * on a laptop in Berlin that hides every month-boundary bug.
     */
    private AnalyticsResponse report(Fixture fx, int year) {
        return asUser(fx, () -> new TransactionTemplate(txManager).execute(tx -> {
            jdbc.execute("SET LOCAL TIME ZONE 'UTC'");
            return analyticsService.forYear(year);
        }));
    }

    /**
     * The summary as it stands on 1 August of the test year in Berlin, so
     * {@link #YEAR} is "this year" whenever the suite runs. Read over a UTC
     * database session for the same reason as {@link #report(Fixture, int)}.
     */
    private YearSummaryResponse summary(Fixture fx) {
        Clock august = Clock.fixed(berlin(YEAR, 8, 1, 12, 0).toInstant(), BERLIN);
        YearSummaryService service = new YearSummaryService(bookingQueryService, settlementPeriods, august);
        return asUser(fx, () -> new TransactionTemplate(txManager).execute(tx -> {
            jdbc.execute("SET LOCAL TIME ZONE 'UTC'");
            return service.currentYear();
        }));
    }

    /**
     * An issued invoice as InvoiceService writes it, at a chosen instant. Its
     * issue year is the Berlin year, as the numbering derives it.
     */
    private UUID issueInvoice(Fixture fx, long totalCents, ZonedDateTime issuedAt) {
        UUID id = UUID.randomUUID();
        int issueYear = issuedAt.withZoneSameInstant(BERLIN).getYear();
        int sequence = nextSequenceNumber++;
        asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager).execute(tx -> {
            entityManager.createNativeQuery("""
                INSERT INTO invoices (id, tenant_id, invoice_number, issue_year, sequence_number, status,
                    tax_mode, issuer_business_name, issuer_address_line1, issuer_postal_code, issuer_city,
                    issuer_country, buyer_name, buyer_email, subtotal_cents, tax_cents, total_cents, issued_at)
                VALUES (:id, :tenantId, :number, :issueYear, :sequence, 'ISSUED',
                    'KLEINUNTERNEHMER', 'Anna Fotografie', 'Hauptstr. 1', '10115', 'Berlin',
                    'DE', 'Maria Kellner', 'maria@example.test', :total, 0, :total, :issuedAt)
                """)
                .setParameter("id", id)
                .setParameter("tenantId", fx.tenantId())
                .setParameter("number", invoiceNumber(issueYear, sequence))
                .setParameter("issueYear", issueYear)
                .setParameter("sequence", sequence)
                .setParameter("total", totalCents)
                .setParameter("issuedAt", issuedAt.toOffsetDateTime())
                .executeUpdate();
            return null;
        }));
        return id;
    }

    /**
     * What InvoiceService.storno writes: a document of its own with the
     * original's amounts negated, issued at its own instant, and then the
     * original flipped to Storniert.
     */
    private void storno(Fixture fx, UUID originalId, ZonedDateTime issuedAt) {
        int issueYear = issuedAt.withZoneSameInstant(BERLIN).getYear();
        int sequence = nextSequenceNumber++;
        asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager).execute(tx -> {
            entityManager.createNativeQuery("""
                INSERT INTO invoices (tenant_id, invoice_number, issue_year, sequence_number, status,
                    tax_mode, issuer_business_name, issuer_address_line1, issuer_postal_code, issuer_city,
                    issuer_country, buyer_name, buyer_email, subtotal_cents, tax_cents, total_cents,
                    storno_of_id, issued_at)
                SELECT tenant_id, :number, :issueYear, :sequence, 'ISSUED',
                    tax_mode, issuer_business_name, issuer_address_line1, issuer_postal_code, issuer_city,
                    issuer_country, buyer_name, buyer_email, -subtotal_cents, -tax_cents, -total_cents,
                    id, :issuedAt
                FROM invoices WHERE id = :originalId
                """)
                .setParameter("number", invoiceNumber(issueYear, sequence))
                .setParameter("issueYear", issueYear)
                .setParameter("sequence", sequence)
                .setParameter("issuedAt", issuedAt.toOffsetDateTime())
                .setParameter("originalId", originalId)
                .executeUpdate();
            entityManager.createNativeQuery("UPDATE invoices SET status = 'STORNIERT' WHERE id = :originalId")
                .setParameter("originalId", originalId)
                .executeUpdate();
            return null;
        }));
    }

    /**
     * What a manual payment writes (PaymentService#recordManualPayment): a
     * succeeded bank transfer, confirmed at a chosen instant.
     */
    private void pay(Fixture fx, UUID invoiceId, long amountCents, ZonedDateTime confirmedAt) {
        asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager).execute(tx -> {
            entityManager.createNativeQuery("""
                INSERT INTO payments (tenant_id, invoice_id, method, status, amount_cents, confirmed_by_user_id,
                    confirmed_at)
                VALUES (:tenantId, :invoiceId, 'UEBERWEISUNG', 'SUCCEEDED', :amount, :userId, :confirmedAt)
                """)
                .setParameter("tenantId", fx.tenantId())
                .setParameter("invoiceId", invoiceId)
                .setParameter("amount", amountCents)
                .setParameter("userId", fx.userId())
                .setParameter("confirmedAt", confirmedAt.toOffsetDateTime())
                .executeUpdate();
            return null;
        }));
    }

    /**
     * Sums the DATEV export's postings for the year: H is revenue, S reverses
     * it, and the amount column is always positive with a comma decimal.
     */
    private long datevBookedCents(Fixture fx, int year) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        asUser(fx, () -> {
            invoiceService.exportDatevCsv(out, year);
            return null;
        });
        String csv = new String(out.toByteArray(), Charset.forName("windows-1252"));
        return Arrays.stream(csv.split("\r\n"))
            .skip(2)
            .filter(row -> !row.isBlank())
            .mapToLong(row -> {
                String[] fields = row.split(";");
                long cents = Long.parseLong(fields[0].replace(",", ""));
                return "S".equals(fields[1]) ? -cents : cents;
            })
            .sum();
    }

    private static String invoiceNumber(int issueYear, int sequence) {
        return issueYear + "-" + String.format(Locale.ROOT, "%04d", sequence);
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
