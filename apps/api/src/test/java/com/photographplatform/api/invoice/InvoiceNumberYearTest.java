package com.photographplatform.api.invoice;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.invoice.domain.Invoice;
import com.photographplatform.api.invoice.domain.TaxCategory;
import com.photographplatform.api.invoice.dto.CreateInvoiceLineItemRequest;
import com.photographplatform.api.invoice.dto.CreateInvoiceRequest;
import com.photographplatform.api.invoice.dto.InvoiceResponse;
import com.photographplatform.api.invoice.repository.InvoiceLineItemRepository;
import com.photographplatform.api.invoice.repository.InvoiceNumberAllocator;
import com.photographplatform.api.invoice.repository.InvoiceRepository;
import com.photographplatform.api.invoice.service.DatevInvoiceExporter;
import com.photographplatform.api.invoice.service.InvoiceDate;
import com.photographplatform.api.invoice.service.InvoicePdfRenderer;
import com.photographplatform.api.invoice.service.InvoiceService;
import com.photographplatform.api.invoice.service.Settlement;
import com.photographplatform.api.payment.service.SucceededPayments;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.tenant.domain.TaxMode;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The invoice number's year and the date printed on the invoice must be the
 * same year.
 *
 * <p>They were not. {@code issued_at} is stamped from the injected {@link Clock},
 * which {@code ClockConfig} pins to {@code BusinessZone} (Europe/Berlin), and
 * both the PDF's Rechnungsdatum and the DATEV Belegdatum are derived from it
 * through {@link InvoiceDate}. The sequence year, though, was read separately as
 * {@code OffsetDateTime.now(ZoneOffset.UTC).getYear()}.
 *
 * <p>For most of the year the two agree, which is what let this survive. In the
 * one to two hours after German midnight on 1 January they do not, and
 * {@code InvoiceDateTest} already pins that instant to a Berlin date in the
 * following year. So an invoice issued there was numbered and filed under the
 * old year while dating itself in the new one: the DATEV export for the old
 * year emitted a document whose Belegdatum falls outside the fiscal window its
 * own header declares, the new year's export did not contain it at all, and a
 * document belonging to the new year had consumed a number out of the old
 * year's sequence — which is exactly the gap-free ordering GoBD is about.
 *
 * <p>This test drives the boundary directly rather than asserting the shape of
 * an ordinary invoice, because an ordinary invoice cannot tell the two
 * implementations apart.
 */
class InvoiceNumberYearTest {

    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID ACTOR_ID = UUID.randomUUID();
    private static final UUID BOOKING_ID = UUID.randomUUID();

    /**
     * 23:30 UTC on 31 December is 00:30 on 1 January in Berlin (CET, +01:00).
     * The same instant {@code InvoiceDateTest#handlesTheWinterOffsetToo} pins
     * to 2027-01-01.
     */
    private static final Instant NEW_YEAR_IN_BERLIN = Instant.parse("2026-12-31T23:30:00Z");

    private InvoiceNumberAllocator numberAllocator;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void numbersAnInvoiceInTheYearItsOwnDateFallsIn() {
        InvoiceService service = serviceAt(NEW_YEAR_IN_BERLIN);

        InvoiceResponse response = issue(service);

        assertThat(response.invoiceNumber())
            .as("the number carries the year the invoice dates itself in, not the UTC one")
            .startsWith("2027-");
    }

    @Test
    void allocatesFromTheSequenceOfTheYearItFilesUnder() {
        InvoiceService service = serviceAt(NEW_YEAR_IN_BERLIN);

        issue(service);

        // The year handed to the allocator is the year the row is filed under
        // (issue_year), and the one exportDatevCsv later selects on. Reading
        // UTC here filed a 2027 document in the 2026 sequence.
        verify(numberAllocator).nextSequenceNumber(eq(TENANT_ID), eq(2027));
    }

    @Test
    void theNumbersYearAndTheDocumentsDateNeverDisagree() {
        InvoiceService service = serviceAt(NEW_YEAR_IN_BERLIN);
        InvoiceRepository invoiceRepository = this.invoiceRepository;

        issue(service);

        ArgumentCaptor<Invoice> saved = ArgumentCaptor.forClass(Invoice.class);
        verify(invoiceRepository).save(saved.capture());
        Invoice invoice = saved.getValue();

        // The invariant, stated once: whatever the clock says, these three are
        // one fact. Belegdatum and Rechnungsdatum both come from issued_at via
        // InvoiceDate; issue_year and the printed number must follow it.
        int datedYear = InvoiceDate.of(invoice.getIssuedAt()).getYear();
        assertThat(invoice.getIssueYear()).isEqualTo(datedYear);
        assertThat(invoice.getInvoiceNumber()).startsWith(datedYear + "-");
    }

    /**
     * Mid-year, where UTC and Berlin agree, nothing changes — so the fix is not
     * quietly shifting every other invoice by a year.
     */
    @Test
    void leavesAnOrdinaryMidYearInvoiceAlone() {
        InvoiceService service = serviceAt(Instant.parse("2026-06-15T10:00:00Z"));

        assertThat(issue(service).invoiceNumber()).startsWith("2026-");
    }

    // ── fixture ──────────────────────────────────────────────────────────────

    private InvoiceRepository invoiceRepository;

    private InvoiceResponse issue(InvoiceService service) {
        return service.issueForBooking(
            BOOKING_ID,
            new CreateInvoiceRequest(
                List.of(new CreateInvoiceLineItemRequest(
                    "Hochzeitspaket", BigDecimal.ONE, 180_000, TaxCategory.STANDARD)),
                null, null, null, null, null, null, null),
            "203.0.113.5");
    }

    private InvoiceService serviceAt(Instant now) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(ACTOR_ID.toString(), null, List.of()));
        TenantContext.setTenant(TENANT_ID.toString());

        invoiceRepository = mock(InvoiceRepository.class);
        InvoiceLineItemRepository lineItemRepository = mock(InvoiceLineItemRepository.class);
        numberAllocator = mock(InvoiceNumberAllocator.class);
        when(numberAllocator.nextSequenceNumber(any(), anyInt())).thenReturn(1);

        BookingRepository bookingRepository = mock(BookingRepository.class);
        when(bookingRepository.findById(BOOKING_ID)).thenReturn(Optional.of(booking()));

        TenantRepository tenantRepository = mock(TenantRepository.class);
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant()));

        InvoicePdfRenderer pdfRenderer = mock(InvoicePdfRenderer.class);
        when(pdfRenderer.render(anyString()))
            .thenReturn(new InvoicePdfRenderer.Rendered(new byte[] {1}, "abc123"));

        R2StorageService storage = mock(R2StorageService.class);
        when(storage.generateDownloadUrl(anyString())).thenReturn("https://cdn.example/i.pdf");

        // The zone matters as much as the instant: this is the clock
        // ClockConfig builds, and the whole point is that the year is read
        // through it rather than beside it.
        Clock clock = Clock.fixed(now, com.photographplatform.api.common.util.BusinessZone.ID);

        // No payments: a mocked SucceededPayments answers an empty map.
        Settlement settlement = new Settlement(invoiceRepository, mock(SucceededPayments.class), clock);

        return new InvoiceService(
            invoiceRepository,
            lineItemRepository,
            numberAllocator,
            bookingRepository,
            mock(UserRepository.class),
            tenantRepository,
            pdfRenderer,
            Optional.of(storage),
            mock(AuditService.class),
            mock(DatevInvoiceExporter.class),
            settlement,
            clock);
    }

    private static Booking booking() {
        Booking booking = new Booking(
            "Sophie Bauer", "sophie@example.com", LocalDate.of(2027, 5, 1));
        booking.setTenantId(TENANT_ID);
        return booking;
    }

    private static Tenant tenant() {
        Tenant tenant = new Tenant("anna-foto", "anna@example.com");
        tenant.setTaxMode(TaxMode.REGELBESTEUERUNG);
        // §14 UStG minimum, or issueForBooking refuses before it ever numbers.
        tenant.setBusinessName("Anna Fotografie");
        tenant.setAddressLine1("Hauptstr. 1");
        tenant.setPostalCode("40210");
        tenant.setCity("Düsseldorf");
        tenant.setTaxId("133/8150/8159");
        return tenant;
    }

    /** Guards the constant above against a careless edit. */
    @Test
    void theBoundaryInstantIsActuallyOnTheBoundary() {
        OffsetDateTime instant = NEW_YEAR_IN_BERLIN.atOffset(ZoneOffset.UTC);

        assertThat(instant.getYear()).as("UTC still says the old year").isEqualTo(2026);
        assertThat(InvoiceDate.of(instant)).isEqualTo(LocalDate.of(2027, 1, 1));
    }
}
