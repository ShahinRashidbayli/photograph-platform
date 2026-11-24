package com.photographplatform.api.invoice;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.util.BusinessZone;
import com.photographplatform.api.invoice.domain.TaxCategory;
import com.photographplatform.api.invoice.dto.CreateInvoiceLineItemRequest;
import com.photographplatform.api.invoice.dto.CreateInvoiceRequest;
import com.photographplatform.api.invoice.dto.InvoiceResponse;
import com.photographplatform.api.invoice.repository.InvoiceLineItemRepository;
import com.photographplatform.api.invoice.repository.InvoiceNumberAllocator;
import com.photographplatform.api.invoice.repository.InvoiceRepository;
import com.photographplatform.api.invoice.service.InvoiceService;
import com.photographplatform.api.payment.dto.RecordManualPaymentRequest;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.domain.TaxMode;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * End-to-end coverage of the F5 invoice domain against a real Postgres
 * container: tax calculation wired through persistence, GoBD sequential
 * numbering under real concurrency, the immutability trigger, Storno
 * correction, and RLS isolation.
 */
class InvoiceServiceIT extends IntegrationTestBase {

    @Autowired private InvoiceService invoiceService;
    @Autowired private com.photographplatform.api.payment.service.PaymentService paymentService;
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private InvoiceLineItemRepository lineItemRepository;
    @Autowired private InvoiceNumberAllocator numberAllocator;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private PlatformTransactionManager txManager;

    @Autowired private PinnableClock clock;

    @MockitoBean
    private R2StorageService r2StorageService;

    @AfterEach
    void releaseClock() {
        clock.release();
    }

    @Test
    void issuesInvoiceWithSequentialNumberAndCorrectTax() {
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);

        when(r2StorageService.generateDownloadUrl(anyString())).thenReturn("https://cdn.example/invoice.pdf");

        InvoiceResponse response = asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Hochzeitspaket", BigDecimal.ONE, 180_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null
            ),
            "203.0.113.5"
        ));

        assertThat(response.invoiceNumber()).matches("\\d{4}-0001");
        assertThat(response.status()).isEqualTo("ISSUED");
        assertThat(response.subtotalCents()).isEqualTo(180_000);
        assertThat(response.taxCents()).isEqualTo(34_200);
        assertThat(response.totalCents()).isEqualTo(214_200);
        assertThat(response.buyerName()).isEqualTo(fx.clientName());
        assertThat(response.lineItems()).hasSize(1);

        verify(r2StorageService).uploadBytes(anyString(), anyString(), any(byte[].class));

        // A second invoice for the same tenant/year gets the next number.
        InvoiceResponse second = asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Zusatzabzug", BigDecimal.ONE, 5_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null
            ),
            "203.0.113.5"
        ));
        assertThat(second.invoiceNumber()).matches("\\d{4}-0002");
    }


    /**
     * The DATEV export is the "your Steuerberater gets it in one click" wedge,
     * and it had no coverage at all while being exposed in Settings. The format
     * is unforgiving: DATEV's importer rejects the file outright — not
     * partially, not with a warning — if the EXTF header, the encoding or the
     * line endings are wrong, and none of that is visible by eyeballing the
     * CSV in a UTF-8 editor.
     */
    @Test
    void datevExportProducesAnImportableBuchungsstapel() {
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);
        when(r2StorageService.generateDownloadUrl(anyString())).thenReturn("https://cdn.example/i.pdf");

        InvoiceResponse invoice = asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Hochzeitspaket", BigDecimal.ONE, 180_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null
            ),
            "203.0.113.5"
        ));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        asUser(fx, () -> {
            invoiceService.exportDatevCsv(out, LocalDate.now().getYear());
            return null;
        });

        // Windows-1252, not UTF-8 — decoding as UTF-8 would mangle every umlaut
        // in a German business name and hide the bug.
        String csv = new String(out.toByteArray(), Charset.forName("windows-1252"));

        assertThat(csv).startsWith("\"EXTF\";700;21;\"Buchungsstapel\";");
        assertThat(csv).contains("Anna Fotografie");
        assertThat(csv.split("\r\n"))
            .as("DATEV requires CRLF; a bare \\n makes the file unreadable to it")
            .hasSizeGreaterThanOrEqualTo(3);
        assertThat(csv).doesNotContain("\n\n");

        // The booking's gross total, DATEV-style: comma decimal separator.
        assertThat(csv).contains("2142,00");
        assertThat(csv).contains(invoice.invoiceNumber());
    }

    @Test
    void datevExportIsScopedToTheRequestedFiscalYear() {
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);
        when(r2StorageService.generateDownloadUrl(anyString())).thenReturn("https://cdn.example/i.pdf");

        asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Hochzeitspaket", BigDecimal.ONE, 180_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null
            ),
            "203.0.113.5"
        ));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        asUser(fx, () -> {
            invoiceService.exportDatevCsv(out, LocalDate.now().getYear() - 1);
            return null;
        });
        String csv = new String(out.toByteArray(), Charset.forName("windows-1252"));

        // A prior year with no invoices still yields a valid, empty batch —
        // handing the Steuerberater last year's turnover would be worse than
        // handing them nothing.
        assertThat(csv).startsWith("\"EXTF\"");
        assertThat(csv).doesNotContain("2142,00");
    }

    @Test
    void kleinunternehmerTenantIsChargedNoTax() {
        TestFixture fx = createTenantAndBooking(TaxMode.KLEINUNTERNEHMER);

        InvoiceResponse response = asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Portraitshooting", BigDecimal.ONE, 30_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null
            ),
            "203.0.113.5"
        ));

        assertThat(response.taxMode()).isEqualTo("KLEINUNTERNEHMER");
        assertThat(response.taxCents()).isZero();
        assertThat(response.totalCents()).isEqualTo(30_000);
    }

    @Test
    void refusesToIssueWithoutABillingProfile() {
        UUID tenantId = tenantRepository.save(new Tenant("no-profile", "np@example.test")).getId();
        UUID bookingId = asTenant(tenantId, () -> {
            Booking booking = new Booking("Client X", "clientx@example.test", LocalDate.now().plusDays(10));
            booking.setTenantId(tenantId);
            return bookingRepository.save(booking).getId();
        });
        User user = asTenant(tenantId, () -> {
            User u = new User(tenantId, "owner@example.test", "hash", "Owner");
            return userRepository.save(u);
        });

        assertThatThrownBy(() -> asUser(new TestFixture(tenantId, user.getId(), bookingId, "Client X"), () ->
            invoiceService.issueForBooking(
                bookingId,
                new CreateInvoiceRequest(
                    List.of(new CreateInvoiceLineItemRequest("X", BigDecimal.ONE, 1_000, TaxCategory.STANDARD)),
                    null, null, null, null, null, null, null),
                "203.0.113.5")
        )).isInstanceOf(ConflictException.class);
    }

    @Test
    void stornoCreatesNegatedCorrectionAndMarksOriginalStorniert() {
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);

        InvoiceResponse original = asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest("Paket", BigDecimal.ONE, 100_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5"));

        InvoiceResponse storno = asUser(fx, () -> invoiceService.storno(original.id(), "203.0.113.5"));

        assertThat(storno.stornoOfId()).isEqualTo(original.id());
        assertThat(storno.totalCents()).isEqualTo(-original.totalCents());
        assertThat(storno.invoiceNumber()).matches("\\d{4}-0002");

        InvoiceResponse reloadedOriginal = asUser(fx, () -> invoiceService.get(original.id()));
        assertThat(reloadedOriginal.status()).isEqualTo("STORNIERT");

        // Storno-ing an already-storniert invoice is rejected.
        assertThatThrownBy(() -> asUser(fx, () -> invoiceService.storno(original.id(), "203.0.113.5")))
            .isInstanceOf(ConflictException.class);
    }

    @Test
    void sequenceNumbersAreUniqueAndGapFreeUnderConcurrency() throws Exception {
        UUID tenantId = tenantRepository.save(new Tenant("concurrency-test", "conc@example.test")).getId();
        int callers = 20;
        ExecutorService pool = Executors.newFixedThreadPool(callers);
        try {
            // TenantContext is a ThreadLocal — each pooled worker thread needs
            // it set independently, not just the test's own thread, or the
            // RLS policy on invoice_counters sees no tenant and rejects the
            // insert.
            List<Callable<Integer>> tasks = IntStream.range(0, callers)
                .<Callable<Integer>>mapToObj(i -> () -> {
                    TenantContext.setTenant(tenantId.toString());
                    try {
                        return new TransactionTemplate(txManager).execute(status ->
                            numberAllocator.nextSequenceNumber(tenantId, 2099));
                    } finally {
                        TenantContext.clear();
                    }
                })
                .toList();
            List<Future<Integer>> futures = pool.invokeAll(tasks);
            List<Integer> numbers = futures.stream().map(f -> {
                try {
                    return f.get();
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }).toList();

            Set<Integer> unique = Set.copyOf(numbers);
            assertThat(unique).hasSize(callers);
            assertThat(unique).isEqualTo(IntStream.rangeClosed(1, callers).boxed().collect(Collectors.toSet()));
        } finally {
            pool.shutdown();
        }
    }

    @Test
    void gobdTriggerBlocksAnyFieldChangeOtherThanStorno() {
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);
        InvoiceResponse issued = asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest("Paket", BigDecimal.ONE, 50_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5"));

        // Attempting to alter an amount on an already-issued invoice must be
        // rejected by trg_invoices_immutable, not silently accepted. The
        // trigger's RAISE EXCEPTION has no explicit SQLSTATE, so Hibernate's
        // exception translator lands on the generic JDBC exception class
        // rather than a more specific Spring DataAccessException subtype —
        // asserting on the DB-level message is what actually matters here.
        assertThatThrownBy(() -> asTenant(fx.tenantId(), () ->
            new TransactionTemplate(txManager).execute(status -> {
                entityManager.createNativeQuery("UPDATE invoices SET total_cents = 1 WHERE id = ?")
                    .setParameter(1, issued.id())
                    .executeUpdate();
                return null;
            })
        )).hasMessageContaining("immutable");

        // Deleting an invoice outright — even a never-touched one — is never
        // permitted (10-year GoBD retention).
        assertThatThrownBy(() -> asTenant(fx.tenantId(), () ->
            new TransactionTemplate(txManager).execute(status -> {
                entityManager.createNativeQuery("DELETE FROM invoices WHERE id = ?")
                    .setParameter(1, issued.id())
                    .executeUpdate();
                return null;
            })
        )).hasMessageContaining("immutable");

        // Editing a line item is likewise rejected outright — there is no
        // legal mutation on invoice_line_items at all.
        UUID lineItemId = asTenant(fx.tenantId(), () ->
            lineItemRepository.findByInvoiceIdOrderBySortOrderAsc(issued.id()).get(0).getId());
        assertThatThrownBy(() -> asTenant(fx.tenantId(), () ->
            new TransactionTemplate(txManager).execute(status -> {
                entityManager.createNativeQuery("UPDATE invoice_line_items SET line_total_cents = 1 WHERE id = ?")
                    .setParameter(1, lineItemId)
                    .executeUpdate();
                return null;
            })
        )).hasMessageContaining("immutable");
    }

    @Test
    void aStornoCannotItselfBeStorniert() {
        // Regression: a Storno is an ISSUED invoice like any other, so the
        // "already storniert" check alone let it be storniert in turn. That
        // negates the already-negated line items back to positive, producing a
        // third document that silently re-bills the client and breaks the
        // net-to-zero invariant Settlement relies on.
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);

        InvoiceResponse original = asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest("Paket", BigDecimal.ONE, 100_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5"));

        InvoiceResponse storno = asUser(fx, () -> invoiceService.storno(original.id(), "203.0.113.5"));

        assertThatThrownBy(() -> asUser(fx, () -> invoiceService.storno(storno.id(), "203.0.113.5")))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("is itself a Storno");

        // Exactly two documents exist for this booking, and they net to zero.
        List<InvoiceResponse> all = asUser(fx, () -> invoiceService.listForBooking(fx.bookingId()));
        assertThat(all).hasSize(2);
        assertThat(all.stream().mapToInt(InvoiceResponse::totalCents).sum()).isZero();
    }

    @Test
    void listForBookingReturnsEveryInvoiceWithItsOwnLineItems() {
        // Guards the N+1 fix: line items are now fetched in one batched query
        // and grouped in memory, so each invoice must still come back with its
        // own lines in sort order — not another invoice's, and not none.
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);

        InvoiceResponse original = asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(
                    new CreateInvoiceLineItemRequest("Fotoshooting", BigDecimal.ONE, 100_000, TaxCategory.STANDARD),
                    new CreateInvoiceLineItemRequest("Anfahrt", BigDecimal.ONE, 5_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5"));
        asUser(fx, () -> invoiceService.storno(original.id(), "203.0.113.5"));

        List<InvoiceResponse> all = asUser(fx, () -> invoiceService.listForBooking(fx.bookingId()));

        assertThat(all).hasSize(2);
        assertThat(all).allSatisfy(inv -> assertThat(inv.lineItems()).hasSize(2));
        assertThat(all).allSatisfy(inv ->
            assertThat(inv.lineItems().get(0).description()).isEqualTo("Fotoshooting"));
    }

    @Test
    void invoicesAreIsolatedByTenantViaRls() {
        TestFixture a = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);
        TestFixture b = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);

        InvoiceResponse invoiceA = asUser(a, () -> invoiceService.issueForBooking(
            a.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest("A", BigDecimal.ONE, 10_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5"));

        TenantContext.setTenant(b.tenantId().toString());
        try {
            assertThat(invoiceRepository.findById(invoiceA.id())).isEmpty();
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void issuingAnInvoiceInsertsWithoutSelectingTheRowsItIsAboutToCreate() {
        // Invoice and InvoiceLineItem assign their own @Id (the PDF is
        // rendered before the INSERT, so the id must exist first). Spring
        // Data's save() reads a non-null id as "existing row" and routes to
        // EntityManager#merge, which SELECTs the current state before
        // inserting — a guaranteed-empty round-trip per row, since the id was
        // minted microseconds earlier. Both entities now implement
        // Persistable so persist() is used instead.
        //
        // Asserted via Hibernate's own counters rather than a plan/log scrape:
        // entityLoadCount is exactly "how many rows did we hydrate from the
        // database", and issuing an invoice should hydrate the booking and
        // the tenant it reads — never the invoice or the lines it writes.
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);
        Statistics stats = entityManager.getEntityManagerFactory()
            .unwrap(SessionFactory.class).getStatistics();
        stats.setStatisticsEnabled(true);
        stats.clear();

        asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(
                    new CreateInvoiceLineItemRequest("Paket", BigDecimal.ONE, 100_000, TaxCategory.STANDARD),
                    new CreateInvoiceLineItemRequest("Anfahrt", BigDecimal.ONE, 5_000, TaxCategory.STANDARD),
                    new CreateInvoiceLineItemRequest("Album", BigDecimal.ONE, 20_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5"));

        // Exactly two entities are hydrated from the database: the booking
        // and the tenant, both of which this path genuinely reads. Before
        // Persistable it was six — those two plus one empty merge SELECT for
        // the invoice and one for each of the three line items, so the count
        // grew with every line billed.
        //
        // Deliberately asserting on loads rather than inserts: AuditService is
        // @Async, so its audit row lands on a pool thread and would make an
        // insert count racy. It loads nothing, which leaves this number
        // deterministic.
        assertThat(stats.getEntityLoadCount()).isEqualTo(2);

        // (Separately measured, not asserted here because the @Async audit
        // insert makes an absolute statement count racy: enabling
        // hibernate.jdbc.batch_size took this same call from 8 JDBC statements
        // to 6 — the three line-item INSERTs collapse into one batch, and the
        // saving grows with every line billed.)
    }

    /**
     * The client-facing list resolves ownership from the caller's identity —
     * their email matched against {@code bookings.client_email} — because a
     * CUSTOMER has no booking id to ask with and no access to the endpoint
     * that takes one. Getting that wrong in the permissive direction would
     * show one client another client's invoice, tax numbers and totals, all
     * inside the same tenant where RLS can't help.
     */
    @Test
    void customerSeesOnlyInvoicesAddressedToTheirOwnEmail() {
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);
        when(r2StorageService.generateDownloadUrl(anyString())).thenReturn("https://cdn.example/invoice.pdf");

        InvoiceResponse theirs = asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Hochzeitsreportage", BigDecimal.ONE, 120_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5"));

        // A second booking, for a different client of the same photographer.
        UUID otherBookingId = asTenant(fx.tenantId(), () -> {
            Booking booking = new Booking("Jonas Weber", "jonas@example.test", LocalDate.now().plusDays(45));
            booking.setTenantId(fx.tenantId());
            return bookingRepository.save(booking).getId();
        });
        asUser(fx, () -> invoiceService.issueForBooking(
            otherBookingId,
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Portrait", BigDecimal.ONE, 40_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5"));

        UUID customerId = asTenant(fx.tenantId(), () -> {
            User customer = new User(fx.tenantId(), "maria@example.test", "hash", "Maria Kellner");
            customer.setRole("CUSTOMER");
            return userRepository.save(customer).getId();
        });

        List<InvoiceResponse> visible = asCustomer(fx.tenantId(), customerId,
            () -> invoiceService.listForCustomer());

        assertThat(visible).extracting(InvoiceResponse::id).containsExactly(theirs.id());
    }

    @Test
    void customerWithNoBookingsSeesNoInvoices() {
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);

        UUID strangerId = asTenant(fx.tenantId(), () -> {
            User stranger = new User(fx.tenantId(), "stranger-" + UUID.randomUUID() + "@example.test",
                "hash", "Nobody");
            stranger.setRole("CUSTOMER");
            return userRepository.save(stranger).getId();
        });

        assertThat(asCustomer(fx.tenantId(), strangerId, () -> invoiceService.listForCustomer())).isEmpty();
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    /**
     * The settlement figures the invoice list carries.
     *
     * <p>They exist so a page of invoices costs one request instead of one per
     * row (see {@code InvoiceResponse}), which only holds if the list path
     * actually populates them. The figures themselves are Settlement's (see
     * {@code SettlementIT}); this pins that both the list and the single-invoice
     * response carry them.
     */
    @Test
    void listedInvoicesCarryTheirOwnPaidAndOutstandingFigures() {
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);
        when(r2StorageService.generateDownloadUrl(anyString())).thenReturn("https://cdn.example/invoice.pdf");

        InvoiceResponse issued = asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Hochzeitspaket", BigDecimal.ONE, 100_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5"));

        assertThat(issued.paidCents()).isZero();
        assertThat(issued.outstandingCents()).isEqualTo(issued.totalCents());
        assertThat(issued.verwendungszweck()).isEqualTo("RE-" + issued.invoiceNumber());

        asUser(fx, () -> paymentService.recordManualPayment(
            issued.id(), new RecordManualPaymentRequest(40_000), "203.0.113.5"));

        List<InvoiceResponse> listed = asUser(fx, () -> invoiceService.listForBooking(fx.bookingId()));
        assertThat(listed).hasSize(1);
        assertThat(listed.get(0).paidCents()).isEqualTo(40_000);
        assertThat(listed.get(0).outstandingCents()).isEqualTo(issued.totalCents() - 40_000);

        InvoiceResponse fetched = asUser(fx, () -> invoiceService.get(issued.id()));
        assertThat(fetched.paidCents()).isEqualTo(listed.get(0).paidCents());
        assertThat(fetched.outstandingCents()).isEqualTo(listed.get(0).outstandingCents());
    }

    /**
     * The Due date and Overdue ride on every invoice the API returns, so no
     * screen works them out for itself. The rules are Settlement's (see
     * {@code SettlementIT}); this pins that the list and the single invoice
     * both carry them, read against the application clock.
     */
    @Test
    void everyInvoiceCarriesItsDueDateAndTurnsOverdueOnceItHasPassed() {
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);
        clock.pin(berlin(2026, 11, 1));

        InvoiceResponse issued = asUser(fx, () -> invoiceService.issueForBooking(
            fx.bookingId(),
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Hochzeitspaket", BigDecimal.ONE, 100_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5"));

        assertThat(issued.dueDate()).isEqualTo(LocalDate.of(2026, 11, 15));
        assertThat(issued.live()).isTrue();
        assertThat(issued.collectable()).isTrue();
        assertThat(issued.overdue()).isFalse();

        clock.pin(berlin(2026, 11, 16));

        InvoiceResponse listed = asUser(fx, () -> invoiceService.listForBooking(fx.bookingId())).get(0);
        InvoiceResponse fetched = asUser(fx, () -> invoiceService.get(issued.id()));
        assertThat(listed.dueDate()).isEqualTo(LocalDate.of(2026, 11, 15));
        assertThat(listed.overdue()).isTrue();
        assertThat(fetched.overdue()).isTrue();
    }

    @Test
    void aStornoAStorniertInvoiceAndAPaidInvoiceAreNotCollectable() {
        TestFixture fx = createTenantAndBooking(TaxMode.REGELBESTEUERUNG);
        CreateInvoiceRequest request = new CreateInvoiceRequest(
            List.of(new CreateInvoiceLineItemRequest("Paket", BigDecimal.ONE, 100_000, TaxCategory.STANDARD)),
            null, null, null, null, null, null, null);

        InvoiceResponse paid = asUser(fx, () -> invoiceService.issueForBooking(fx.bookingId(), request, "203.0.113.5"));
        asUser(fx, () -> paymentService.recordManualPayment(
            paid.id(), new RecordManualPaymentRequest(null), "203.0.113.5"));
        InvoiceResponse withdrawn =
            asUser(fx, () -> invoiceService.issueForBooking(fx.bookingId(), request, "203.0.113.5"));
        InvoiceResponse storno = asUser(fx, () -> invoiceService.storno(withdrawn.id(), "203.0.113.5"));

        Map<UUID, InvoiceResponse> listed = asUser(fx, () -> invoiceService.listForBooking(fx.bookingId()))
            .stream().collect(Collectors.toMap(InvoiceResponse::id, r -> r));

        assertThat(listed.get(paid.id()).live()).isTrue();
        assertThat(listed.get(paid.id()).collectable()).isFalse();
        for (UUID id : List.of(withdrawn.id(), storno.id())) {
            assertThat(listed.get(id).live()).isFalse();
            assertThat(listed.get(id).collectable()).isFalse();
            assertThat(listed.get(id).outstandingCents()).isZero();
            assertThat(listed.get(id).dueDate()).isNull();
        }
    }

    private record TestFixture(UUID tenantId, UUID userId, UUID bookingId, String clientName) {
    }

    private static Instant berlin(int year, int month, int day) {
        return LocalDateTime.of(year, month, day, 10, 0).atZone(BusinessZone.ID).toInstant();
    }

    /**
     * The application clock, pinnable per test: Overdue is decided against
     * it, and a test reading real time would pass or fail by the calendar.
     * Runs on real time unless a test pins it, so the rest of this class is
     * unaffected.
     */
    static final class PinnableClock extends Clock {

        private volatile Instant pinned;

        void pin(Instant at) {
            pinned = at;
        }

        void release() {
            pinned = null;
        }

        @Override
        public Instant instant() {
            Instant at = pinned;
            return at != null ? at : Instant.now();
        }

        @Override
        public ZoneId getZone() {
            return BusinessZone.ID;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return Clock.fixed(instant(), zone);
        }
    }

    @TestConfiguration
    static class PinnableClockConfig {

        @Bean
        @Primary
        PinnableClock pinnableClock() {
            return new PinnableClock();
        }
    }

    private TestFixture createTenantAndBooking(TaxMode taxMode) {
        UUID tenantId = asTransaction(() -> {
            Tenant tenant = new Tenant(
                "invoice-test-" + UUID.randomUUID(),
                "billing-" + UUID.randomUUID() + "@example.test");
            tenant.setBusinessName("Anna Fotografie");
            tenant.setAddressLine1("Musterstraße 1");
            tenant.setPostalCode("10115");
            tenant.setCity("Berlin");
            tenant.setCountry("DE");
            // §14 Abs. 4 Nr. 2 UStG — Steuernummer or USt-IdNr. Without one,
            // hasBillingProfile() is false and issuance is refused.
            tenant.setTaxId("21/815/08150");
            tenant.setTaxMode(taxMode);
            return tenantRepository.save(tenant).getId();
        });

        UUID userId = asTenant(tenantId, () -> {
            User user = new User(
                tenantId, "photographer-" + UUID.randomUUID() + "@example.test", "hash", "Anna");
            return userRepository.save(user).getId();
        });

        String clientName = "Maria Kellner";
        UUID bookingId = asTenant(tenantId, () -> {
            Booking booking = new Booking(clientName, "maria@example.test", LocalDate.now().plusDays(30));
            booking.setTenantId(tenantId);
            return bookingRepository.save(booking).getId();
        });

        return new TestFixture(tenantId, userId, bookingId, clientName);
    }

    /** Same as {@link #asUser} but for an arbitrary (customer) principal. */
    private <T> T asCustomer(UUID tenantId, UUID userId, java.util.function.Supplier<T> action) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(userId.toString(), null));
        TenantContext.setTenant(tenantId.toString());
        try {
            return action.get();
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    private <T> T asUser(TestFixture fx, java.util.function.Supplier<T> action) {
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

    private <T> T asTenant(UUID tenantId, java.util.function.Supplier<T> action) {
        TenantContext.setTenant(tenantId.toString());
        try {
            return action.get();
        } finally {
            TenantContext.clear();
        }
    }

    private <T> T asTransaction(java.util.function.Supplier<T> action) {
        return new TransactionTemplate(txManager).execute(status -> action.get());
    }
}
