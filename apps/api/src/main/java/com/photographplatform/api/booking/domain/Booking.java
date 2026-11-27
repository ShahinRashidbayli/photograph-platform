package com.photographplatform.api.booking.domain;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.domain.CustomerLanguageConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "bookings")
public class Booking {

    /** What an erased client's name reads as; see {@link #erasePersonalData()}. */
    public static final String ERASED_CLIENT_NAME = "[gelöscht]";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    /**
     * Optimistic-lock counter (V30). Present so a lifecycle change is a
     * conditional write rather than a last-writer-wins overwrite — see the
     * migration for the interleavings this closes. Nothing reads it; Hibernate
     * owns it entirely, hence no setter.
     */
    @Version
    @Column(nullable = false)
    private long version;

    @Column(name = "client_id")
    private UUID clientId;

    /**
     * The signed-in customer this booking belongs to, or null while nobody has
     * an account for it.
     *
     * <p>Not {@link #clientId}, which points at the photographer's own address
     * book and is not a login; and not {@link #clientEmail}, which is a contact
     * detail that the edit form may change. V31 has the whole reasoning.
     *
     * <p>Null is a real state: a booking taken over the phone exists before its
     * customer does. Those fall back to the email match until someone signs up.
     */
    @Column(name = "customer_user_id")
    private UUID customerUserId;

    @Column(name = "lead_id")
    private UUID leadId;

    @Column(name = "inquiry_id")
    private UUID inquiryId;

    @Column(name = "client_name", nullable = false, length = 200)
    private String clientName;

    @Column(name = "client_email", nullable = false, length = 320)
    private String clientEmail;

    @Column(name = "event_date", nullable = false)
    private LocalDate eventDate;

    @Column(name = "event_time")
    private LocalTime eventTime;

    @Column(name = "event_type", length = 50)
    private String eventType;

    @Column(name = "location", length = 300)
    private String location;

    @Column(name = "package_id")
    private UUID packageId;

    @Column(name = "total_amount_cents", nullable = false)
    private Integer totalAmountCents = 0;

    @Column(name = "deposit_amount_cents", nullable = false)
    private Integer depositAmountCents = 0;

    /**
     * Stored as text via {@code @Enumerated(STRING)} rather than mapped to a
     * {@code String} field: the column and its CHECK constraint are unchanged
     * — Hibernate writes {@code name()} into the same varchar — but the type
     * system now knows what the values are. It used to be a String, so every
     * read went through {@code BookingStatus.parse} and every write through
     * {@code .name()}, which put a parse of trusted, already-validated data on
     * paths that could not fail and pushed the enum out to the edges of a
     * class whose whole subject is the lifecycle.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BookingStatus status = BookingStatus.ENQUIRY;

    /**
     * The photographer shooting this, or null while nobody has decided.
     *
     * <p>Null is a real state, not a gap to be filled: a booking arrives from
     * an enquiry before anyone has been assigned, and inventing an answer then
     * looks like a decision that was never made.
     */
    @Column(name = "assigned_user_id")
    private UUID assignedUserId;

    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    /** The language every Customer message about this record is written in (V40). */
    @Convert(converter = CustomerLanguageConverter.class)
    @Column(nullable = false, length = 2)
    private CustomerLanguage language = CustomerLanguage.DEFAULT;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    protected Booking() {
    }

    public Booking(String clientName, String clientEmail, LocalDate eventDate) {
        this.clientName = clientName;
        this.clientEmail = clientEmail;
        this.eventDate = eventDate;
    }

    // ── behaviour ────────────────────────────────────────────────────────────

    /**
     * Move to the next lifecycle state, or refuse.
     *
     * <p>Here rather than in the service because it is the one rule that is
     * true of a booking wherever it is written from. The service still owns
     * <em>who</em> may ask and what gets audited; it no longer owns whether the
     * move is legal.
     *
     * @throws com.photographplatform.api.common.exception.ConflictException on
     *     an illegal transition, or on re-entering the current state
     */
    public void changeStatus(BookingStatus next) {
        status.assertCanTransitionTo(next);
        this.status = next;
    }

    /**
     * Whether this booking's facts may still be edited. False once the shoot is
     * delivered or called off: repricing or re-dating it then describes nothing
     * that will happen, and on a completed booking it silently disagrees with
     * the invoice already issued against it.
     */
    public boolean isEditable() {
        return !status.isClosedForEdits();
    }

    /**
     * Set the package and the two amounts together, because they are only
     * valid together — see {@link BookingPricing}, which is what enforces it.
     */
    public void applyPricing(BookingPricing pricing) {
        this.packageId = pricing.packageId();
        this.totalAmountCents = pricing.totalCents();
        this.depositAmountCents = pricing.depositCents();
    }

    /**
     * What the quote has still to bring in (Uncollected): the quoted value
     * less {@code paidCents}, never below zero. Zero unless the booking is
     * Billable, because nothing is agreed on an enquiry and nothing is owed on
     * a shoot that is Not happening. Here because Billable is booking's rule;
     * web used to work this out from its own copy of the Billable statuses.
     *
     * @param paidCents what has been paid for this booking, as Settlement
     *     counts it
     */
    public int uncollectedCents(int paidCents) {
        if (!status.isBillable()) {
            return 0;
        }
        int quoted = totalAmountCents != null ? totalAmountCents : 0;
        return Math.max(quoted - paidCents, 0);
    }

    /** @param userId the staff member shooting this, or null to clear it */
    public void assignTo(UUID userId) {
        this.assignedUserId = userId;
    }

    /**
     * Removes everything that identifies the client (Art. 17 GDPR), keeping
     * what the studio's books and statistics still need: the date, type,
     * package, amounts and status of a booking that did happen.
     *
     * <p>{@code client_email} is {@code NOT NULL}, so it becomes an address under
     * {@code .invalid}, a TLD reserved never to resolve (RFC 2606): nothing can
     * be sent to it. One per booking, so two erased clients never read as one
     * returning customer, and none of them as the next person to sign up.
     */
    public void erasePersonalData() {
        this.clientName = ERASED_CLIENT_NAME;
        this.clientEmail = "erased-" + id + "@erased.invalid";
        this.location = null;
        this.internalNotes = null;
        this.clientId = null;
        this.customerUserId = null;
        this.leadId = null;
        this.inquiryId = null;
    }

    // ── accessors ────────────────────────────────────────────────────────────

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getCustomerUserId() {
        return customerUserId;
    }

    /**
     * Binds the booking to a customer account. Once set, {@code clientEmail} is
     * contact information and nothing more — editing it no longer moves who can
     * see this booking, its invoices or its payments.
     */
    public void linkCustomer(UUID customerUserId) {
        this.customerUserId = customerUserId;
    }

    public UUID getClientId() {
        return clientId;
    }

    public void setClientId(UUID clientId) {
        this.clientId = clientId;
    }

    public UUID getLeadId() {
        return leadId;
    }

    public void setLeadId(UUID leadId) {
        this.leadId = leadId;
    }

    public UUID getInquiryId() {
        return inquiryId;
    }

    public void setInquiryId(UUID inquiryId) {
        this.inquiryId = inquiryId;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getClientEmail() {
        return clientEmail;
    }

    public void setClientEmail(String clientEmail) {
        this.clientEmail = clientEmail;
    }

    public LocalDate getEventDate() {
        return eventDate;
    }

    public void setEventDate(LocalDate eventDate) {
        this.eventDate = eventDate;
    }

    public LocalTime getEventTime() {
        return eventTime;
    }

    public void setEventTime(LocalTime eventTime) {
        this.eventTime = eventTime;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public UUID getPackageId() {
        return packageId;
    }

    public Integer getTotalAmountCents() {
        return totalAmountCents;
    }

    public Integer getDepositAmountCents() {
        return depositAmountCents;
    }

    public BookingStatus getStatus() {
        return status;
    }

    public UUID getAssignedUserId() {
        return assignedUserId;
    }

    public String getInternalNotes() {
        return internalNotes;
    }

    public void setInternalNotes(String internalNotes) {
        this.internalNotes = internalNotes;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public CustomerLanguage getLanguage() {
        return language;
    }

    public void setLanguage(CustomerLanguage language) {
        this.language = language;
    }
}
