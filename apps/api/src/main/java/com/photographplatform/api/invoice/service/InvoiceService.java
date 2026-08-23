package com.photographplatform.api.invoice.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UnauthorizedException;
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
import com.photographplatform.api.payment.repository.PaymentRepository;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.io.OutputStream;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
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
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final InvoicePdfRenderer pdfRenderer;
    private final Clock clock;
    private final Optional<R2StorageService> storage;
    private final AuditService auditService;
    private final DatevInvoiceExporter datevExporter;
    private final PaymentRepository paymentRepository;

    public InvoiceService(
        InvoiceRepository invoiceRepository,
        InvoiceLineItemRepository lineItemRepository,
        InvoiceNumberAllocator numberAllocator,
        BookingRepository bookingRepository,
        UserRepository userRepository,
        TenantRepository tenantRepository,
        InvoicePdfRenderer pdfRenderer,
        Optional<R2StorageService> storage,
        AuditService auditService,
        DatevInvoiceExporter datevExporter,
        PaymentRepository paymentRepository,
        Clock clock
    ) {
        this.invoiceRepository = invoiceRepository;
        this.lineItemRepository = lineItemRepository;
        this.numberAllocator = numberAllocator;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.pdfRenderer = pdfRenderer;
        this.storage = storage;
        this.auditService = auditService;
        this.datevExporter = datevExporter;
        this.paymentRepository = paymentRepository;
        this.clock = clock;
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
                "Complete your business details in Settings — §14 UStG requires your business name, "
                    + "address and either your Steuernummer or USt-IdNr. on every invoice");
        }

        List<InvoiceTaxCalculator.LineInput> inputs = req.lineItems().stream()
            .map(li -> new InvoiceTaxCalculator.LineInput(
                li.description(), li.quantity(), li.unitPriceCents(), li.taxCategory()))
            .toList();
        InvoiceTaxCalculator.Totals totals = InvoiceTaxCalculator.calculate(inputs, tenant.getTaxMode());

        Numbering numbering = allocateNumber(tenantId);

        Invoice invoice = new Invoice(
            tenantId,
            bookingId,
            numbering.invoiceNumber(),
            numbering.issueYear(),
            numbering.sequenceNumber(),
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
            null,
            OffsetDateTime.now(clock)
        );

        List<InvoiceLineItem> lineItems = buildLineItems(tenantId, invoice.getId(), totals);

        renderAndAttachPdf(tenantId, invoice, lineItems, null);

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
        // A Storno is itself an invoice with ISSUED status, so without this
        // guard it could be storniert in turn — producing a third document
        // whose line items are negated twice, i.e. a positive-amount "credit
        // note" that silently re-bills the client and breaks the net-to-zero
        // invariant BookingPaymentStateResolver depends on. Correcting a
        // correction means issuing a fresh invoice, not stornoing the Storno.
        if (original.getStornoOfId() != null) {
            throw new ConflictException(
                "Invoice " + original.getInvoiceNumber() + " is itself a Storno and cannot be storniert — "
                    + "issue a new invoice instead");
        }

        List<InvoiceLineItem> originalLines = lineItemRepository.findByInvoiceIdOrderBySortOrderAsc(invoiceId);

        Numbering numbering = allocateNumber(tenantId);

        Invoice storno = new Invoice(
            tenantId,
            original.getBookingId(),
            numbering.invoiceNumber(),
            numbering.issueYear(),
            numbering.sequenceNumber(),
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
            original.getId(),
            OffsetDateTime.now(clock)
        );

        List<InvoiceLineItem> stornoLines = originalLines.stream()
            .map(l -> new InvoiceLineItem(
                tenantId, storno.getId(), l.getDescription(), l.getQuantity(),
                -l.getUnitPriceCents(), l.getTaxCategory(), l.getTaxRatePercent(),
                -l.getLineTotalCents(), l.getSortOrder()
            ))
            .toList();

        renderAndAttachPdf(tenantId, storno, stornoLines, original);

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
    public void exportDatevCsv(OutputStream out, int year) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Tenant not found"));
        List<Invoice> invoices = invoiceRepository.findByIssueYearOrderByIssuedAtAsc(year);
        datevExporter.write(out, invoices, year, tenant.getBusinessName());
    }

    @Transactional(readOnly = true)
    public List<InvoiceResponse> listForBooking(UUID bookingId) {
        return toResponses(invoiceRepository.findByBookingIdOrderByIssuedAtDesc(bookingId));
    }

    /**
     * Every invoice addressed to the authenticated customer, newest first.
     *
     * <p>The photographer-facing {@code listForBooking} can't serve this: it
     * takes a booking id the customer has no way to enumerate, and {@code
     * /api/bookings/**} is closed to CUSTOMER tokens anyway. Ownership is
     * resolved the same way {@code BookingService#getOwnBookings} and {@code
     * PaymentService#requireOwnedByCallerIfCustomer} do it — from the JWT's
     * user, matched on {@code client_email}, never from a caller-supplied id.
     * RLS still scopes everything to the one tenant the token belongs to.
     */
    @Transactional(readOnly = true)
    public List<InvoiceResponse> listForCustomer() {
        var user = userRepository.findById(SecurityUtils.requireCurrentUserId())
            .orElseThrow(() -> new UnauthorizedException("Authentication required"));
        List<UUID> bookingIds = bookingRepository.findByClientEmailIgnoreCase(user.getEmail())
            .stream().map(Booking::getId).toList();
        if (bookingIds.isEmpty()) {
            return List.of();
        }
        return toResponses(invoiceRepository.findByBookingIdInOrderByIssuedAtDesc(bookingIds));
    }

    /**
     * Invoices with their line items, in one extra query rather than one per
     * invoice.
     *
     * <p>Shared by both list endpoints because the grouping is not incidental
     * detail — it is the N+1 fix, and it was written out twice. Two copies of a
     * batching strategy is one copy away from a later edit re-introducing the
     * per-row lookup on whichever side nobody was looking at.
     */
    private List<InvoiceResponse> toResponses(List<Invoice> invoices) {
        if (invoices.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = invoices.stream().map(Invoice::getId).toList();
        Map<UUID, List<InvoiceLineItem>> linesByInvoice = lineItemRepository
            .findByInvoiceIdInOrderByInvoiceIdAscSortOrderAsc(ids)
            .stream()
            .collect(Collectors.groupingBy(InvoiceLineItem::getInvoiceId));
        // One grouped query for the whole page's settlement figures. Invoices
        // with no successful payment are simply absent from the result, hence
        // the getOrDefault rather than an entry per id.
        Map<UUID, Long> paidByInvoice = paymentRepository
            .sumSucceededAmountCentsGroupedByInvoiceId(ids)
            .stream()
            .collect(Collectors.toMap(
                PaymentRepository.SucceededSum::getInvoiceId, PaymentRepository.SucceededSum::getTotal));

        return invoices.stream()
            .map(inv -> toResponse(
                inv,
                linesByInvoice.getOrDefault(inv.getId(), List.of()),
                paidByInvoice.getOrDefault(inv.getId(), 0L)))
            .toList();
    }

    /**
     * The tenant's next gap-free invoice number, plus the parts it is built
     * from — issuance and Storno both need all three, and deriving them in two
     * places invited the year and the sequence drifting apart across a
     * new-year boundary.
     */
    private record Numbering(int issueYear, int sequenceNumber, String invoiceNumber) {
    }

    private Numbering allocateNumber(UUID tenantId) {
        int issueYear = OffsetDateTime.now(ZoneOffset.UTC).getYear();
        int sequenceNumber = numberAllocator.nextSequenceNumber(tenantId, issueYear);
        return new Numbering(
            issueYear, sequenceNumber,
            issueYear + "-" + String.format(Locale.ROOT, "%04d", sequenceNumber));
    }

    /**
     * Renders the invoice to PDF, uploads it to R2 and records the key + hash
     * on the (still unsaved) entity. Must run before the insert — see the
     * class javadoc for why there is no post-insert window to attach it.
     */
    private void renderAndAttachPdf(UUID tenantId, Invoice invoice, List<InvoiceLineItem> lines, Invoice original) {
        String html = InvoicePdfTemplate.render(invoice, lines, original);
        InvoicePdfRenderer.Rendered rendered = pdfRenderer.render(html);
        String r2Key = tenantId + "/invoices/" + invoice.getInvoiceNumber() + ".pdf";
        requireStorage().uploadBytes(r2Key, "application/pdf", rendered.bytes());
        invoice.attachPdf(r2Key, rendered.sha256Hex());
    }

    private List<InvoiceLineItem> buildLineItems(UUID tenantId, UUID invoiceId, InvoiceTaxCalculator.Totals totals) {
        List<InvoiceLineItem> lines = new ArrayList<>();
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

    /**
     * Reads the paid total for one invoice, then renders it. Only for the
     * single-invoice paths — a list must use {@link #toResponses} instead,
     * which resolves every invoice's total in one grouped query.
     */
    private InvoiceResponse toResponse(Invoice invoice, List<InvoiceLineItem> lines) {
        return toResponse(invoice, lines, paymentRepository.sumSucceededAmountCents(invoice.getId()));
    }

    private InvoiceResponse toResponse(Invoice invoice, List<InvoiceLineItem> lines, long paidCents) {
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
            (int) paidCents,
            (int) Math.max(0, invoice.getTotalCents() - paidCents),
            invoice.getVerwendungszweck(),
            invoice.getStornoOfId(),
            downloadUrl,
            invoice.getIssuedAt(),
            lineResponses
        );
    }
}
