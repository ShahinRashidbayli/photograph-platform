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

    // ── Fotolio's own subscription — the photographer pays US (V20) ──
    // Separate from the Connect columns above in every sense: those decide
    // whether this photographer can take money from their clients, these
    // decide whether they may keep using the product at all.

    @Column(name = "stripe_customer_id", length = 255)
    private String stripeCustomerId;

    @Column(name = "stripe_subscription_id", length = 255)
    private String stripeSubscriptionId;

    @Column(name = "subscription_status", nullable = false, length = 30)
    private String subscriptionStatus = SubscriptionStatus.TRIALING.name();

    @Column(name = "current_period_end")
    private OffsetDateTime currentPeriodEnd;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    // ── Legal identity (§5 DDG Impressum, Art. 13 GDPR privacy notice) ────────
    // The photographer — not the platform — is the data controller for their
    // clients' enquiries, so their public pages must carry their own details.
    // All nullable: see V12__tenant_legal_details.sql for why completeness is a
    // service-layer rule rather than a column constraint.

    @Column(name = "legal_name", length = 200)
    private String legalName;

    @Column(name = "legal_street", length = 200)
    private String legalStreet;

    @Column(name = "legal_postal_code", length = 20)
    private String legalPostalCode;

    @Column(name = "legal_city", length = 120)
    private String legalCity;

    @Column(name = "legal_country", length = 80)
    private String legalCountry = "Deutschland";

    @Column(name = "legal_email", length = 320)
    private String legalEmail;

    @Column(name = "legal_phone", length = 50)
    private String legalPhone;

    @Column(name = "legal_vat_id", length = 50)
    private String legalVatId;

    @Column(name = "legal_register", length = 200)
    private String legalRegister;

    @Column(name = "legal_responsible", length = 200)
    private String legalResponsible;

    @Column(name = "privacy_contact_email", length = 320)
    private String privacyContactEmail;

    /**
     * Whether a Customer who sends an enquiry through the public request form
     * gets the automatic acknowledgement. On by default; a studio that answers
     * every enquiry personally switches it off (V40).
     */
    @Column(name = "enquiry_acknowledgement_enabled", nullable = false)
    private boolean enquiryAcknowledgementEnabled = true;

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

    /**
     * R2 object key for the studio's logo, or null. Not a URL — download URLs
     * are pre-signed and expire, so storing one stores a link that stops
     * working.
     */
    @Column(name = "logo_key", length = 500)
    private String logoKey;

    /** `#RRGGBB` accent for client-facing surfaces, or null for the default. */
    @Column(name = "brand_color", length = 7)
    private String brandColor;

    public String getLogoKey() {
        return logoKey;
    }

    public void setLogoKey(String logoKey) {
        this.logoKey = logoKey;
    }

    /**
     * Whether {@link #logoKey} is an object the logo presign endpoint minted
     * for this studio ({@code AvatarService.presign(…, "logos")}). The key is
     * stored as the owner sent it, so it may be an absolute URL or point into
     * another studio's objects; only this shape may be signed and served.
     */
    public boolean hasOwnLogoObject() {
        return logoKey != null && id != null
            && logoKey.matches("logos/" + id + "/[0-9a-f-]{36}\\.[a-z0-9]+");
    }

    public String getBrandColor() {
        return brandColor;
    }

    public void setBrandColor(String brandColor) {
        this.brandColor = brandColor;
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

    /**
     * The plan as a type rather than a string. Every branch on a tier goes
     * through this — see {@link Plan#from(String)} for why an unreadable value
     * degrades to STARTER instead of failing or defaulting generously.
     */
    public Plan plan() {
        return Plan.from(plan);
    }

    public void setPlan(Plan plan) {
        this.plan = plan.name();
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

    public String getStripeCustomerId() {
        return stripeCustomerId;
    }

    public void setStripeCustomerId(String stripeCustomerId) {
        this.stripeCustomerId = stripeCustomerId;
    }

    public String getStripeSubscriptionId() {
        return stripeSubscriptionId;
    }

    public SubscriptionStatus getSubscriptionStatus() {
        return SubscriptionStatus.from(subscriptionStatus);
    }

    public OffsetDateTime getCurrentPeriodEnd() {
        return currentPeriodEnd;
    }

    public OffsetDateTime getTrialEndsAt() {
        return trialEndsAt;
    }

    /**
     * Copies subscription state from Stripe in one call.
     *
     * <p>Grouped for the same reason as {@link #applyStripeCapabilities}:
     * status, subscription id and period end are three facets of one remote
     * object, and writing one without the others produces a local mirror that
     * never existed at Stripe — the kind of split state that later reads as
     * "active subscription that ended last month".
     */
    public void applySubscription(
        String subscriptionId, SubscriptionStatus status, OffsetDateTime periodEnd) {
        this.stripeSubscriptionId = subscriptionId;
        this.subscriptionStatus = status.name();
        this.currentPeriodEnd = periodEnd;
    }

    /** True while the advertised 14-day trial is still running. */
    public boolean isTrialActive(OffsetDateTime now) {
        return trialEndsAt != null && trialEndsAt.isAfter(now);
    }

    /**
     * True when a paid subscription currently entitles this tenant, ignoring
     * the trial. See {@link SubscriptionStatus#grantsAccess()} for why
     * PAST_DUE still counts.
     */
    public boolean hasActiveSubscription() {
        return getSubscriptionStatus().grantsAccess();
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

    // ── Legal identity ────────────────────────────────────────────────────────

    public String getLegalName() {
        return legalName;
    }

    public void setLegalName(String legalName) {
        this.legalName = legalName;
    }

    public String getLegalStreet() {
        return legalStreet;
    }

    public void setLegalStreet(String legalStreet) {
        this.legalStreet = legalStreet;
    }

    public String getLegalPostalCode() {
        return legalPostalCode;
    }

    public void setLegalPostalCode(String legalPostalCode) {
        this.legalPostalCode = legalPostalCode;
    }

    public String getLegalCity() {
        return legalCity;
    }

    public void setLegalCity(String legalCity) {
        this.legalCity = legalCity;
    }

    public String getLegalCountry() {
        return legalCountry;
    }

    public void setLegalCountry(String legalCountry) {
        this.legalCountry = legalCountry;
    }

    public String getLegalEmail() {
        return legalEmail;
    }

    public void setLegalEmail(String legalEmail) {
        this.legalEmail = legalEmail;
    }

    public String getLegalPhone() {
        return legalPhone;
    }

    public void setLegalPhone(String legalPhone) {
        this.legalPhone = legalPhone;
    }

    public String getLegalVatId() {
        return legalVatId;
    }

    public void setLegalVatId(String legalVatId) {
        this.legalVatId = legalVatId;
    }

    public String getLegalRegister() {
        return legalRegister;
    }

    public void setLegalRegister(String legalRegister) {
        this.legalRegister = legalRegister;
    }

    /** §18 Abs. 2 MStV; falls back to the provider name for a sole trader. */
    public String getLegalResponsible() {
        return legalResponsible == null || legalResponsible.isBlank()
            ? legalName : legalResponsible;
    }

    public void setLegalResponsible(String legalResponsible) {
        this.legalResponsible = legalResponsible;
    }

    /** Art. 13(1)(b) GDPR contact; falls back to the Impressum address. */
    public String getPrivacyContactEmail() {
        return privacyContactEmail == null || privacyContactEmail.isBlank()
            ? legalEmail : privacyContactEmail;
    }

    public void setPrivacyContactEmail(String privacyContactEmail) {
        this.privacyContactEmail = privacyContactEmail;
    }

    public boolean isEnquiryAcknowledgementEnabled() {
        return enquiryAcknowledgementEnabled;
    }

    public void setEnquiryAcknowledgementEnabled(boolean enquiryAcknowledgementEnabled) {
        this.enquiryAcknowledgementEnabled = enquiryAcknowledgementEnabled;
    }
}
