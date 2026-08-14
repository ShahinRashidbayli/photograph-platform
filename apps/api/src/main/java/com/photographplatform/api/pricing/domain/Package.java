package com.photographplatform.api.pricing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * A pricing package the photographer offers (e.g. "Standard wedding — 8h, 300
 * edited photos, €1,800"). Lives in the per-tenant schema; selecting one on a
 * booking auto-seeds {@code total_amount_cents}.
 *
 * <p>Money is stored as integer cents ({@code price_cents}) per the platform
 * rule — never floats. {@code duration_hours} is the only fractional value and
 * uses {@link BigDecimal} mapped to {@code NUMERIC(4,1)} so half-hour packages
 * ("3.5h") round-trip exactly.
 */
@Entity
@Table(name = "packages")
public class Package {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "price_cents", nullable = false)
    private Integer priceCents;

    @Column(nullable = false, length = 3)
    private String currency = "EUR";

    @Column(name = "duration_hours", precision = 4, scale = 1)
    private BigDecimal durationHours;

    @Column(name = "included_photos")
    private Integer includedPhotos;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    protected Package() {
    }

    public Package(String name, Integer priceCents) {
        this.name = name;
        this.priceCents = priceCents;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getPriceCents() {
        return priceCents;
    }

    public void setPriceCents(Integer priceCents) {
        this.priceCents = priceCents;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public BigDecimal getDurationHours() {
        return durationHours;
    }

    public void setDurationHours(BigDecimal durationHours) {
        this.durationHours = durationHours;
    }

    public Integer getIncludedPhotos() {
        return includedPhotos;
    }

    public void setIncludedPhotos(Integer includedPhotos) {
        this.includedPhotos = includedPhotos;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }
}
