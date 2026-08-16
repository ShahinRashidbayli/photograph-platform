package com.photographplatform.api.tenant.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(schema = "public", name = "tenants")
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 63)
    private String subdomain;

    @Column(name = "owner_email", nullable = false, unique = true, length = 320)
    private String ownerEmail;

    @Column(nullable = false, length = 20)
    private String plan = "STARTER";

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "trial_ends_at")
    private OffsetDateTime trialEndsAt;

    // ── billing profile — required on the issuer of every invoice (§14 UStG) ──

    @Column(name = "business_name", length = 200)
    private String businessName;

    @Column(name = "address_line1", length = 200)
    private String addressLine1;

    @Column(name = "address_line2", length = 200)
    private String addressLine2;

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    @Column(length = 100)
    private String city;

    @Column(nullable = false, length = 2)
    private String country = "DE";

    @Column(name = "tax_id", length = 50)
    private String taxId;

    @Column(name = "vat_id", length = 50)
    private String vatId;

    @Column(name = "tax_mode", nullable = false, length = 20)
    private String taxMode = TaxMode.KLEINUNTERNEHMER.name();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected Tenant() {
    }

    public Tenant(String subdomain, String ownerEmail) {
        this.subdomain = subdomain;
        this.ownerEmail = ownerEmail;
    }

    public UUID getId() {
        return id;
    }

    public String getSubdomain() {
        return subdomain;
    }

    public void setSubdomain(String subdomain) {
        this.subdomain = subdomain;
    }

    public String getOwnerEmail() {
        return ownerEmail;
    }

    public void setOwnerEmail(String ownerEmail) {
        this.ownerEmail = ownerEmail;
    }

    public String getPlan() {
        return plan;
    }

    public void setPlan(String plan) {
        this.plan = plan;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OffsetDateTime getTrialEndsAt() {
        return trialEndsAt;
    }

    public void setTrialEndsAt(OffsetDateTime trialEndsAt) {
        this.trialEndsAt = trialEndsAt;
    }

    public String getBusinessName() {
        return businessName;
    }

    public void setBusinessName(String businessName) {
        this.businessName = businessName;
    }

    public String getAddressLine1() {
        return addressLine1;
    }

    public void setAddressLine1(String addressLine1) {
        this.addressLine1 = addressLine1;
    }

    public String getAddressLine2() {
        return addressLine2;
    }

    public void setAddressLine2(String addressLine2) {
        this.addressLine2 = addressLine2;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getTaxId() {
        return taxId;
    }

    public void setTaxId(String taxId) {
        this.taxId = taxId;
    }

    public String getVatId() {
        return vatId;
    }

    public void setVatId(String vatId) {
        this.vatId = vatId;
    }

    public TaxMode getTaxMode() {
        return TaxMode.valueOf(taxMode);
    }

    public void setTaxMode(TaxMode taxMode) {
        this.taxMode = taxMode.name();
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    /**
     * True once every field §14 UStG requires on an invoice issuer is
     * present.
     *
     * <p>Strictly, §14 Abs. 4 Nr. 2 UStG also requires either the
     * Steuernummer ({@code taxId}) or the Umsatzsteuer-ID ({@code vatId}) —
     * deliberately NOT enforced here yet: nothing in this codebase currently
     * lets a tenant set either field (no settings endpoint, no onboarding
     * step — {@code setTaxId}/{@code setVatId} have zero callers outside
     * this class), so requiring one would just make {@code issueForBooking}
     * permanently unissuable for every tenant. Add the check back once a
     * billing-profile settings endpoint actually collects these.
     */
    public boolean hasBillingProfile() {
        return businessName != null && !businessName.isBlank()
            && addressLine1 != null && !addressLine1.isBlank()
            && postalCode != null && !postalCode.isBlank()
            && city != null && !city.isBlank();
    }
}
