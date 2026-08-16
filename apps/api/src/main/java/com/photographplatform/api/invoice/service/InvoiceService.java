package com.photographplatform.api.invoice.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.invoice.domain.Invoice;
import com.photographplatform.api.invoice.domain.InvoiceLineItem;
import com.photographplatform.api.invoice.domain.InvoiceStatus;
import com.photographplatform.api.invoice.dto.CreateInvoiceRequest;
import com.photographplatform.api.invoice.dto.InvoiceLineItemResponse;
import com.photographplatform.api.invoice.dto.InvoiceResponse;
import com.photographplatform.api.invoice.repository.InvoiceLineItemRepository;
import com.photographplatform.api.invoice.repository.InvoiceNumberAllocator;
import com.photographplatform.api.invoice.repository.InvoiceRepository;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * German invoice issuance and correction.
 *
 * <p>The PDF is rendered and uploaded to R2 <em>before</em> the {@code
 * Invoice} row is inserted, not after: the row is GoBD-immutable from the
 * moment it exists (see {@code trg_invoices_immutable} in V13), and the only
 * legal post-insert mutation is the ISSUED→STORNIERT transition — there is no
 * window to attach a PDF reference afterwards. Rendering first means the
 * insert already carries the final {@code pdf_r2_key}/{@code pdf_sha256}.
 */
@Service
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final InvoiceLineItemRepository lineItemRepository;
    private final InvoiceNumberAllocator numberAllocator;
    private final BookingRepository bookingRepository;
    private final TenantRepository tenantRepository;
    private final InvoicePdfRenderer pdfRenderer;
    private final Optional<R2StorageService> storage;
    private final AuditService auditService;
    private final DatevInvoiceExporter datevExporter;

    public InvoiceService(
        InvoiceRepository invoiceRepository,
        InvoiceLineItemRepository lineItemRepository,
        InvoiceNumberAllocator numberAllocator,
        BookingRepository bookingRepository,
        TenantRepository tenantRepository,
        InvoicePdfRenderer pdfRenderer,
        Optional<R2StorageService> storage,
        AuditService auditService,
        DatevInvoiceExporter datevExporter
    ) {
        this.invoiceRepository = invoiceRepository;
        this.lineItemRepository = lineItemRepository;
        this.numberAllocator = numberAllocator;
        this.bookingRepository = bookingRepository;
        this.tenantRepository = tenantRepository;
        this.pdfRenderer = pdfRenderer;
        this.storage = storage;
        this.auditService = auditService;
        this.datevExporter = datevExporter;
    }

    @Transactional
    public InvoiceResponse issueForBooking(UUID bookingId, CreateInvoiceRequest req, String ipAddress) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();

        Booking booking = bookingRepository.findById(bookingId)
            .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Tenant not found"));

        BookingStatus bookingStatus = BookingStatus.parse(booking.getStatus());
        if (bookingStatus == BookingStatus.DECLINED || bookingStatus == BookingStatus.CANCELLED) {
            throw new ConflictException(
                "Cannot issue an invoice for a " + bookingStatus.name().toLowerCase(Locale.ROOT) + " booking");
        }

        if (!tenant.hasBillingProfile()) {
            throw new ConflictException(
                "Complete your business details (name, address) before issuing an invoice");
        }

        List<InvoiceTaxCalculator.LineInput> inputs = req.lineItems().stream()
            .map(li -> new InvoiceTaxCalculator.LineInput(
                li.description(), li.quantity(), li.unitPriceCents(), li.taxCategory()))
            .toList();
        InvoiceTaxCalculator.Totals totals = InvoiceTaxCalculator.calculate(inputs, tenant.getTaxMode());

        int issueYear = OffsetDateTime.now(ZoneOffset.UTC).getYear();
        int sequenceNumber = numberAllocator.nextSequenceNumber(tenantId, issueYear);
        String invoiceNumber = issueYear + "-" + String.format(Locale.ROOT, "%04d", sequenceNumber);

        Invoice invoice = new Invoice(
            tenantId,
            bookingId,
            invoiceNumber,
            issueYear,
            sequenceNumber,
            tenant.getTaxMode(),
            new Invoice.Issuer(
                tenant.getBusinessName(), tenant.getAddressLine1(), tenant.getAddressLine2(),
                tenant.getPostalCode(), tenant.getCity(), tenant.getCountry(),
                tenant.getTaxId(), tenant.getVatId()
            ),
            new Invoice.Buyer(
                booking.getClientName(), booking.getClientEmail(), req.buyerAddressLine1(),
                req.buyerAddressLine2(), req.buyerPostalCode(), req.buyerCity(),
                req.buyerCountry(), req.buyerReference()
            ),
            req.paymentTerms(),
            totals.subtotalCents(),
            totals.taxCents(),
            totals.totalCents(),
            null
        );

        List<InvoiceLineItem> lineItems = buildLineItems(tenantId, invoice.getId(), totals);

        String html = InvoicePdfTemplate.render(invoice, lineItems, null);
        InvoicePdfRenderer.Rendered rendered = pdfRenderer.render(html);
        String r2Key = pdfKey(tenantId, invoiceNumber);
        requireStorage().uploadBytes(r2Key, "application/pdf", rendered.bytes());
        invoice.attachPdf(r2Key, rendered.sha256Hex());

        invoiceRepository.save(invoice);
        lineItemRepository.saveAll(lineItems);

        auditService.log("INVOICE_ISSUED", "INVOICE", invoice.getId(), tenantId, actorId, ipAddress);

        return toResponse(invoice, lineItems);
    }

    /**
     * GoBD correction: the original invoice is never edited or deleted. This
     * creates a new invoice with negated line items (own sequence number,
     * own PDF) referencing the original via {@code storno_of_id}, then flips
     * the original's status to STORNIERT — the one mutation the immutability
     * trigger allows.
     */
    @Transactional
    public InvoiceResponse storno(UUID invoiceId, String ipAddress) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();

        Invoice original = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new NotFoundException("Invoice not found: " + invoiceId));
        if (original.getStatus() == InvoiceStatus.STORNIERT) {
            throw new ConflictException("Invoice " + original.getInvoiceNumber() + " is already storniert");
        }

        List<InvoiceLineItem> originalLines = lineItemRepository.findByInvoiceIdOrderBySortOrderAsc(invoiceId);

        int issueYear = OffsetDateTime.now(ZoneOffset.UTC).getYear();
        int sequenceNumber = numberAllocator.nextSequenceNumber(tenantId, issueYear);
        String invoiceNumber = issueYear + "-" + String.format(Locale.ROOT, "%04d", sequenceNumber);

        Invoice storno = new Invoice(
            tenantId,
            original.getBookingId(),
            invoiceNumber,
            issueYear,
            sequenceNumber,
            original.getTaxMode(),
            new Invoice.Issuer(
                original.getIssuerBusinessName(), original.getIssuerAddressLine1(), original.getIssuerAddressLine2(),
                original.getIssuerPostalCode(), original.getIssuerCity(), original.getIssuerCountry(),
                original.getIssuerTaxId(), original.getIssuerVatId()
            ),
            new Invoice.Buyer(
                original.getBuyerName(), original.getBuyerEmail(), original.getBuyerAddressLine1(),
                original.getBuyerAddressLine2(), original.getBuyerPostalCode(), original.getBuyerCity(),
                original.getBuyerCountry(), original.getBuyerReference()
            ),
            original.getPaymentTerms(),
            -original.getSubtotalCents(),
            -original.getTaxCents(),
            -original.getTotalCents(),
            original.getId()
        );

        List<InvoiceLineItem> stornoLines = originalLines.stream()
            .map(l -> new InvoiceLineItem(
                tenantId, storno.getId(), l.getDescription(), l.getQuantity(),
                -l.getUnitPriceCents(), l.getTaxCategory(), l.getTaxRatePercent(),
                -l.getLineTotalCents(), l.getSortOrder()
            ))
            .toList();

        String html = InvoicePdfTemplate.render(storno, stornoLines, original);
        InvoicePdfRenderer.Rendered rendered = pdfRenderer.render(html);
        String r2Key = pdfKey(tenantId, invoiceNumber);
        requireStorage().uploadBytes(r2Key, "application/pdf", rendered.bytes());
        storno.attachPdf(r2Key, rendered.sha256Hex());

        invoiceRepository.save(storno);
        lineItemRepository.saveAll(stornoLines);

        original.markStornied();
        invoiceRepository.save(original);

        auditService.log("INVOICE_STORNIERT", "INVOICE", storno.getId(), tenantId, actorId, ipAddress,
            original.getInvoiceNumber(), storno.getInvoiceNumber());

        return toResponse(storno, stornoLines);
    }

    @Transactional(readOnly = true)
    public InvoiceResponse get(UUID invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new NotFoundException("Invoice not found: " + invoiceId));
        List<InvoiceLineItem> lines = lineItemRepository.findByInvoiceIdOrderBySortOrderAsc(invoiceId);
        return toResponse(invoice, lines);
    }

    @Transactional(readOnly = true)
    public void exportDatevCsv(java.io.OutputStream out, int year) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Tenant not found"));
        List<Invoice> invoices = invoiceRepository.findByIssueYearOrderByIssuedAtAsc(year);
        datevExporter.write(out, invoices, year, tenant.getBusinessName());
    }

    @Transactional(readOnly = true)
    public List<InvoiceResponse> listForBooking(UUID bookingId) {
        return invoiceRepository.findByBookingIdOrderByIssuedAtDesc(bookingId).stream()
            .map(inv -> toResponse(inv, lineItemRepository.findByInvoiceIdOrderBySortOrderAsc(inv.getId())))
            .toList();
    }

    private List<InvoiceLineItem> buildLineItems(UUID tenantId, UUID invoiceId, InvoiceTaxCalculator.Totals totals) {
        List<InvoiceLineItem> lines = new java.util.ArrayList<>();
        int sortOrder = 0;
        for (InvoiceTaxCalculator.LineResult r : totals.lines()) {
            lines.add(new InvoiceLineItem(
                tenantId, invoiceId, r.description(), r.quantity(), r.unitPriceCents(),
                r.taxCategory(), r.taxRatePercent(), r.lineTotalCents(), sortOrder++
            ));
        }
        return lines;
    }

    private R2StorageService requireStorage() {
        return storage.orElseThrow(() -> new IllegalStateException("R2 storage not configured"));
    }

    private static String pdfKey(UUID tenantId, String invoiceNumber) {
        return tenantId + "/invoices/" + invoiceNumber + ".pdf";
    }

    private InvoiceResponse toResponse(Invoice invoice, List<InvoiceLineItem> lines) {
        String downloadUrl = storage.map(s -> s.generateDownloadUrl(invoice.getPdfR2Key())).orElse(null);
        List<InvoiceLineItemResponse> lineResponses = lines.stream()
            .map(l -> new InvoiceLineItemResponse(
                l.getDescription(), l.getQuantity(), l.getUnitPriceCents(),
                l.getTaxCategory().name(), l.getTaxRatePercent(), l.getLineTotalCents()
            ))
            .toList();
        return new InvoiceResponse(
            invoice.getId(),
            invoice.getBookingId(),
            invoice.getInvoiceNumber(),
            invoice.getStatus().name(),
            invoice.getTaxMode().name(),
            invoice.getBuyerName(),
            invoice.getBuyerEmail(),
            invoice.getCurrency(),
            invoice.getSubtotalCents(),
            invoice.getTaxCents(),
            invoice.getTotalCents(),
            invoice.getStornoOfId(),
            downloadUrl,
            invoice.getIssuedAt(),
            lineResponses
        );
    }
}
