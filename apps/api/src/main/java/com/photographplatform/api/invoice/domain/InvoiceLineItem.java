package com.photographplatform.api.invoice.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.domain.Persistable;

/**
 * One billed line on an {@link Invoice}. Immutable at the database layer
 * (see {@code trg_invoice_line_items_immutable} in V13) — a correction is a
 * new invoice with new line items, never an edit of these.
 */
@Entity
@Table(name = "invoice_line_items")
public class InvoiceLineItem implements Persistable<UUID> {

    @Id
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "invoice_id", nullable = false, updatable = false)
    private UUID invoiceId;

    @Column(nullable = false, updatable = false, length = 300)
    private String description;

    @Column(nullable = false, updatable = false, precision = 10, scale = 2)
    private BigDecimal quantity;

    @Column(name = "unit_price_cents", nullable = false, updatable = false)
    private Integer unitPriceCents;

    @Column(name = "tax_category", nullable = false, updatable = false, length = 20)
    private String taxCategory;

    @Column(name = "tax_rate_percent", nullable = false, updatable = false, precision = 4, scale = 2)
    private BigDecimal taxRatePercent;

    @Column(name = "line_total_cents", nullable = false, updatable = false)
    private Integer lineTotalCents;

    @Column(name = "sort_order", nullable = false, updatable = false)
    private Integer sortOrder;

    /**
     * See {@link Invoice#isNew} — same self-assigned-id / {@code merge()}
     * problem, and it matters more here: an invoice's line items are saved
     * with {@code saveAll()}, so the wasted SELECT was one per line, per
     * invoice issued.
     */
    @jakarta.persistence.Transient
    private boolean isNew = true;

    protected InvoiceLineItem() {
        this.isNew = false;
    }

    public InvoiceLineItem(
        UUID tenantId,
        UUID invoiceId,
        String description,
        BigDecimal quantity,
        Integer unitPriceCents,
        TaxCategory taxCategory,
        BigDecimal taxRatePercent,
        Integer lineTotalCents,
        Integer sortOrder
    ) {
        this.id = UUID.randomUUID();
        this.tenantId = tenantId;
        this.invoiceId = invoiceId;
        this.description = description;
        this.quantity = quantity;
        this.unitPriceCents = unitPriceCents;
        this.taxCategory = taxCategory.name();
        this.taxRatePercent = taxRatePercent;
        this.lineTotalCents = lineTotalCents;
        this.sortOrder = sortOrder;
    }

    @Override
    public UUID getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @jakarta.persistence.PostPersist
    @jakarta.persistence.PostLoad
    void markNotNew() {
        this.isNew = false;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public UUID getInvoiceId() {
        return invoiceId;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public Integer getUnitPriceCents() {
        return unitPriceCents;
    }

    public TaxCategory getTaxCategory() {
        return TaxCategory.valueOf(taxCategory);
    }

    public BigDecimal getTaxRatePercent() {
        return taxRatePercent;
    }

    public Integer getLineTotalCents() {
        return lineTotalCents;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }
}
