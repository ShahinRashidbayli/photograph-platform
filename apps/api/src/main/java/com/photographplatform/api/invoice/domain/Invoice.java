package com.photographplatform.api.invoice.domain;

import com.photographplatform.api.tenant.domain.TaxMode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.domain.Persistable;

/**
 * A German invoice. GoBD-immutable once inserted (see
 * {@code trg_invoices_immutable} in V13): the only legal mutation is the
 * single {@code ISSUED -> STORNIERT} transition performed by {@link
 * com.photographplatform.api.invoice.service.InvoiceService#storno}.
 *
 * <p>The id is assigned in Java, not DB-generated ({@code @GeneratedValue}):
 * {@link com.photographplatform.api.invoice.service.InvoiceService} needs the
 * id before the row exists, to embed it in the PDF it renders and uploads
 * <em>before</em> the single INSERT that creates this row — see that class
 * for why (avoids ever needing a post-insert UPDATE, which the immutability
 * trigger wouldn't allow anyway).
 */
@Entity
@Table(name = "invoices")
public class Invoice implements Persistable<UUID> {

    @Id
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "booking_id", updatable = false)
    private UUID bookingId;

    @Column(name = "invoice_number", nullable = false, updatable = false, length = 20)
    private String invoiceNumber;

    @Column(name = "issue_year", nullable = false, updatable = false)
    private Integer issueYear;

    @Column(name = "sequence_number", nullable = false, updatable = false)
    private Integer sequenceNumber;

    @Column(nullable = false, length = 20)
    private String status = InvoiceStatus.ISSUED.name();

    @Column(name = "tax_mode", nullable = false, updatable = false, length = 20)
    private String taxMode;

    @Column(name = "issuer_business_name", nullable = false, updatable = false, length = 200)
    private String issuerBusinessName;

    @Column(name = "issuer_address_line1", nullable = false, updatable = false, length = 200)
    private String issuerAddressLine1;

    @Column(name = "issuer_address_line2", updatable = false, length = 200)
    private String issuerAddressLine2;

    @Column(name = "issuer_postal_code", nullable = false, updatable = false, length = 20)
    private String issuerPostalCode;

    @Column(name = "issuer_city", nullable = false, updatable = false, length = 100)
    private String issuerCity;

    @Column(name = "issuer_country", nullable = false, updatable = false, length = 2)
    private String issuerCountry;

    @Column(name = "issuer_tax_id", updatable = false, length = 50)
    private String issuerTaxId;

    @Column(name = "issuer_vat_id", updatable = false, length = 50)
    private String issuerVatId;

    @Column(name = "buyer_name", nullable = false, updatable = false, length = 200)
    private String buyerName;

    @Column(name = "buyer_email", nullable = false, updatable = false, length = 320)
    private String buyerEmail;

    @Column(name = "buyer_address_line1", updatable = false, length = 200)
    private String buyerAddressLine1;

    @Column(name = "buyer_address_line2", updatable = false, length = 200)
    private String buyerAddressLine2;

    @Column(name = "buyer_postal_code", updatable = false, length = 20)
    private String buyerPostalCode;

    @Column(name = "buyer_city", updatable = false, length = 100)
    private String buyerCity;

    @Column(name = "buyer_country", updatable = false, length = 2)
    private String buyerCountry;

    @Column(name = "buyer_reference", updatable = false, length = 100)
    private String buyerReference;

    @Column(name = "payment_terms", updatable = false, length = 200)
    private String paymentTerms;

    @Column(nullable = false, updatable = false, length = 3)
    private String currency = "EUR";

    @Column(name = "subtotal_cents", nullable = false, updatable = false)
    private Integer subtotalCents;

    @Column(name = "tax_cents", nullable = false, updatable = false)
    private Integer taxCents;

    @Column(name = "total_cents", nullable = false, updatable = false)
    private Integer totalCents;

    @Column(name = "storno_of_id", updatable = false)
    private UUID stornoOfId;

    @Column(name = "pdf_r2_key", updatable = false, length = 500)
    private String pdfR2Key;

    @Column(name = "pdf_sha256", updatable = false, length = 64)
    private String pdfSha256;

    @Column(name = "issued_at", nullable = false, updatable = false)
    private OffsetDateTime issuedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    /**
     * True from construction until the row has been persisted or loaded. Not
     * a column — {@code @Transient} keeps it out of the mapping entirely.
     *
     * <p>Needed because this entity assigns its own {@code @Id} (see class
     * javadoc). Spring Data's default {@code save()} treats a non-null id as
     * "this is an existing row" and calls {@code EntityManager#merge}, which
     * issues a SELECT to load the current state before the INSERT. For an id
     * we just minted with {@code UUID.randomUUID()} that SELECT can only ever
     * return nothing — it is a guaranteed-empty round-trip on the invoice
     * issuance path, and the same again for every line item. Implementing
     * {@link Persistable} lets {@code isNew()} answer authoritatively so
     * {@code persist()} is used instead.
     */
    @jakarta.persistence.Transient
    private boolean isNew = true;

    protected Invoice() {
        // Hibernate materialises an existing row through this constructor, so
        // an entity that arrives from the database is by definition not new.
        this.isNew = false;
    }

    /**
     * The issuer (tenant/photographer) side of an invoice — grouped into one
     * value object, along with {@link Buyer}, so the constructor below
     * doesn't take two runs of same-typed name/address/tax-id strings back
     * to back. That flat shape previously made it easy to transpose a field
     * between the issuer and buyer blocks with no compiler error; the two
     * record types make that a type mismatch instead.
     */
    public record Issuer(
        String businessName,
        String addressLine1,
        String addressLine2,
        String postalCode,
        String city,
        String country,
        String taxId,
        String vatId
    ) {
    }

    /** The buyer (client) side of an invoice — see {@link Issuer}. */
    public record Buyer(
        String name,
        String email,
        String addressLine1,
        String addressLine2,
        String postalCode,
        String city,
        String country,
        String reference
    ) {
    }

    public Invoice(
        UUID tenantId,
        UUID bookingId,
        String invoiceNumber,
        Integer issueYear,
        Integer sequenceNumber,
        TaxMode taxMode,
        Issuer issuer,
        Buyer buyer,
        String paymentTerms,
        Integer subtotalCents,
        Integer taxCents,
        Integer totalCents,
        UUID stornoOfId
    ) {
        this.id = UUID.randomUUID();
        this.tenantId = tenantId;
        this.bookingId = bookingId;
        this.invoiceNumber = invoiceNumber;
        this.issueYear = issueYear;
        this.sequenceNumber = sequenceNumber;
        this.taxMode = taxMode.name();
        this.issuerBusinessName = issuer.businessName();
        this.issuerAddressLine1 = issuer.addressLine1();
        this.issuerAddressLine2 = issuer.addressLine2();
        this.issuerPostalCode = issuer.postalCode();
        this.issuerCity = issuer.city();
        this.issuerCountry = issuer.country();
        this.issuerTaxId = issuer.taxId();
        this.issuerVatId = issuer.vatId();
        this.buyerName = buyer.name();
        this.buyerEmail = buyer.email();
        this.buyerAddressLine1 = buyer.addressLine1();
        this.buyerAddressLine2 = buyer.addressLine2();
        this.buyerPostalCode = buyer.postalCode();
        this.buyerCity = buyer.city();
        this.buyerCountry = buyer.country();
        this.buyerReference = buyer.reference();
        this.paymentTerms = paymentTerms;
        this.subtotalCents = subtotalCents;
        this.taxCents = taxCents;
        this.totalCents = totalCents;
        this.stornoOfId = stornoOfId;
        this.issuedAt = OffsetDateTime.now();
        this.createdAt = this.issuedAt;
    }

    /**
     * Sets the PDF reference before the first (and only) persist. Safe
     * despite the columns being {@code updatable = false}: that annotation
     * only suppresses Hibernate's dirty-check UPDATE on later flushes — the
     * initial INSERT always writes every mapped field. Must be called before
     * {@code save()}; the immutability trigger blocks any attempt to set it
     * afterwards. See {@link com.photographplatform.api.invoice.service.InvoiceService}
     * for why the PDF is rendered before the row is inserted at all.
     */
    public void attachPdf(String pdfR2Key, String pdfSha256) {
        this.pdfR2Key = pdfR2Key;
        this.pdfSha256 = pdfSha256;
    }

    @Override
    public UUID getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    /**
     * Called by Hibernate after the INSERT and after loading a row, so a
     * second {@code save()} on the same instance (as {@code storno()} does
     * when it flips the original to STORNIERT) correctly issues an UPDATE.
     */
    @jakarta.persistence.PostPersist
    @jakarta.persistence.PostLoad
    void markNotNew() {
        this.isNew = false;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public UUID getBookingId() {
        return bookingId;
    }

    /**
     * What the client writes on a bank transfer so the photographer can match
     * it to this invoice.
     *
     * <p>On the invoice because it is a property of the document, not of any
     * one screen. It used to be assembled inside {@code
     * PaymentService#getSummary}, which meant the invoice list had no way to
     * show it without also fetching a payment summary per row.
     */
    public String getVerwendungszweck() {
        return "RE-" + invoiceNumber;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public Integer getIssueYear() {
        return issueYear;
    }

    public Integer getSequenceNumber() {
        return sequenceNumber;
    }

    public InvoiceStatus getStatus() {
        return InvoiceStatus.valueOf(status);
    }

    /** Only legal mutation on an issued invoice — see class javadoc. */
    public void markStornied() {
        this.status = InvoiceStatus.STORNIERT.name();
    }

    public TaxMode getTaxMode() {
        return TaxMode.valueOf(taxMode);
    }

    public String getIssuerBusinessName() {
        return issuerBusinessName;
    }

    public String getIssuerAddressLine1() {
        return issuerAddressLine1;
    }

    public String getIssuerAddressLine2() {
        return issuerAddressLine2;
    }

    public String getIssuerPostalCode() {
        return issuerPostalCode;
    }

    public String getIssuerCity() {
        return issuerCity;
    }

    public String getIssuerCountry() {
        return issuerCountry;
    }

    public String getIssuerTaxId() {
        return issuerTaxId;
    }

    public String getIssuerVatId() {
        return issuerVatId;
    }

    public String getBuyerName() {
        return buyerName;
    }

    public String getBuyerEmail() {
        return buyerEmail;
    }

    public String getBuyerAddressLine1() {
        return buyerAddressLine1;
    }

    public String getBuyerAddressLine2() {
        return buyerAddressLine2;
    }

    public String getBuyerPostalCode() {
        return buyerPostalCode;
    }

    public String getBuyerCity() {
        return buyerCity;
    }

    public String getBuyerCountry() {
        return buyerCountry;
    }

    public String getBuyerReference() {
        return buyerReference;
    }

    public String getPaymentTerms() {
        return paymentTerms;
    }

    public String getCurrency() {
        return currency;
    }

    public Integer getSubtotalCents() {
        return subtotalCents;
    }

    public Integer getTaxCents() {
        return taxCents;
    }

    public Integer getTotalCents() {
        return totalCents;
    }

    public UUID getStornoOfId() {
        return stornoOfId;
    }

    public String getPdfR2Key() {
        return pdfR2Key;
    }

    public String getPdfSha256() {
        return pdfSha256;
    }

    public OffsetDateTime getIssuedAt() {
        return issuedAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
