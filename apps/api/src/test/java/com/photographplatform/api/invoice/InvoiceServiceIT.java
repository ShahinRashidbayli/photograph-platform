package com.photographplatform.api.invoice;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.invoice.domain.TaxCategory;
import com.photographplatform.api.invoice.dto.CreateInvoiceLineItemRequest;
import com.photographplatform.api.invoice.dto.CreateInvoiceRequest;
import com.photographplatform.api.invoice.dto.InvoiceResponse;
import com.photographplatform.api.invoice.repository.InvoiceLineItemRepository;
import com.photographplatform.api.invoice.repository.InvoiceNumberAllocator;
import com.photographplatform.api.invoice.repository.InvoiceRepository;
import com.photographplatform.api.invoice.service.InvoiceService;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.domain.TaxMode;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
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
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private InvoiceLineItemRepository lineItemRepository;
    @Autowired private InvoiceNumberAllocator numberAllocator;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private PlatformTransactionManager txManager;

    @MockitoBean
    private R2StorageService r2StorageService;

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

    // ── fixtures ──────────────────────────────────────────────────────────

    private record TestFixture(UUID tenantId, UUID userId, UUID bookingId, String clientName) {
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
