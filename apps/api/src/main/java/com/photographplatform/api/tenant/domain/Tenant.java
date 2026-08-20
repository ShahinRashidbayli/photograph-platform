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

    // ── Stripe Connect (Express) — the photographer is the merchant of record ──
    // Charges are created directly on this connected account (see
    // PaymentService), so the money lands where the invoice says it did and
    // the platform takes its commission via application_fee_amount.

    @Column(name = "stripe_account_id", length = 255)
    private String stripeAccountId;

    @Column(name = "stripe_charges_enabled", nullable = false)
    private boolean stripeChargesEnabled;

    @Column(name = "stripe_payouts_enabled", nullable = false)
    private boolean stripePayoutsEnabled;

    @Column(name = "stripe_details_submitted", nullable = false)
    private boolean stripeDetailsSubmitted;

    @Column(name = "stripe_onboarded_at")
    private OffsetDateTime stripeOnboardedAt;

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

    public String getStripeAccountId() {
        return stripeAccountId;
    }

    public void setStripeAccountId(String stripeAccountId) {
        this.stripeAccountId = stripeAccountId;
    }

    public boolean isStripeChargesEnabled() {
        return stripeChargesEnabled;
    }

    public boolean isStripePayoutsEnabled() {
        return stripePayoutsEnabled;
    }

    public boolean isStripeDetailsSubmitted() {
        return stripeDetailsSubmitted;
    }

    public OffsetDateTime getStripeOnboardedAt() {
        return stripeOnboardedAt;
    }

    /**
     * Copies the connected account's capability flags from Stripe.
     *
     * <p>Set together rather than through three independent setters because
     * they are three facets of one remote state — writing one without the
     * others produces a mirror that never existed at Stripe. {@code
     * stripeOnboardedAt} is stamped the first time charges go live and then
     * left alone: Stripe can revoke {@code charges_enabled} later (pending
     * re-verification, say), and that must not erase the fact that the
     * photographer did complete onboarding.
     */
    public void applyStripeCapabilities(boolean chargesEnabled, boolean payoutsEnabled, boolean detailsSubmitted) {
        this.stripeChargesEnabled = chargesEnabled;
        this.stripePayoutsEnabled = payoutsEnabled;
        this.stripeDetailsSubmitted = detailsSubmitted;
        if (chargesEnabled && this.stripeOnboardedAt == null) {
            this.stripeOnboardedAt = OffsetDateTime.now();
        }
    }

    /** True when this tenant can accept a card/SEPA charge right now. */
    public boolean canAcceptStripePayments() {
        return stripeAccountId != null && !stripeAccountId.isBlank() && stripeChargesEnabled;
    }

    /**
     * True once every field §14 UStG requires on an invoice issuer is
     * present: the issuer's full name and address (Abs. 4 Nr. 1) and either
     * the Steuernummer or the Umsatzsteuer-ID (Abs. 4 Nr. 2).
     *
     * <p>The tax-number half of that used to be commented out, because
     * nothing in the codebase could set {@code taxId}/{@code vatId} — no
     * settings endpoint, no onboarding step — so enforcing it would have made
     * {@code issueForBooking} permanently unissuable. {@code
     * TenantSettingsController} now collects the whole profile, so the
     * requirement is back where the statute puts it.
     */
    public boolean hasBillingProfile() {
        return businessName != null && !businessName.isBlank()
            && addressLine1 != null && !addressLine1.isBlank()
            && postalCode != null && !postalCode.isBlank()
            && city != null && !city.isBlank()
            && hasTaxIdentifier();
    }

    /** §14 Abs. 4 Nr. 2 UStG — Steuernummer or USt-IdNr., at least one. */
    public boolean hasTaxIdentifier() {
        return (taxId != null && !taxId.isBlank()) || (vatId != null && !vatId.isBlank());
    }
}
