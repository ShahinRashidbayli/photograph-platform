package com.photographplatform.api.payment.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * A single payment attempt/receipt against an {@link
 * com.photographplatform.api.invoice.domain.Invoice}. Not GoBD-immutable
 * like an invoice — this row's {@code status} legitimately transitions as
 * Stripe webhooks arrive (PENDING → SUCCEEDED/FAILED), or once when a
 * photographer manually confirms a bank transfer.
 */
@Entity
@Table(name = "payments")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "invoice_id", nullable = false, updatable = false)
    private UUID invoiceId;

    @Column(nullable = false, updatable = false, length = 20)
    private String method;

    @Column(nullable = false, length = 20)
    private String status = PaymentStatus.PENDING.name();

    @Column(name = "amount_cents", nullable = false, updatable = false)
    private Integer amountCents;

    @Column(nullable = false, updatable = false, length = 3)
    private String currency = "EUR";

    @Column(name = "stripe_payment_intent_id", updatable = false, length = 255)
    private String stripePaymentIntentId;

    /**
     * The connected account the PaymentIntent was created on. Needed to
     * retrieve or cancel it later — a direct-charge intent does not exist
     * from the platform account's point of view — and checked against the
     * webhook event's own {@code account} so an event from a different
     * connected account can never settle this row.
     */
    @Column(name = "stripe_account_id", updatable = false, length = 255)
    private String stripeAccountId;

    /**
     * The platform's commission on this charge, in cents. A historical fact,
     * not a derived one: the tenant's plan (and so its rate) can change after
     * the money has moved.
     */
    @Column(name = "application_fee_cents", nullable = false, updatable = false)
    private Integer applicationFeeCents = 0;

    @Column(name = "confirmed_by_user_id")
    private UUID confirmedByUserId;

    @Column(name = "confirmed_at")
    private OffsetDateTime confirmedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    protected Payment() {
    }

    public Payment(
        UUID tenantId,
        UUID invoiceId,
        PaymentMethod method,
        Integer amountCents,
        String stripePaymentIntentId
    ) {
        this(tenantId, invoiceId, method, amountCents, stripePaymentIntentId, null, 0);
    }

    public Payment(
        UUID tenantId,
        UUID invoiceId,
        PaymentMethod method,
        Integer amountCents,
        String stripePaymentIntentId,
        String stripeAccountId,
        Integer applicationFeeCents
    ) {
        this.tenantId = tenantId;
        this.invoiceId = invoiceId;
        this.method = method.name();
        this.amountCents = amountCents;
        this.stripePaymentIntentId = stripePaymentIntentId;
        this.stripeAccountId = stripeAccountId;
        this.applicationFeeCents = applicationFeeCents != null ? applicationFeeCents : 0;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public UUID getInvoiceId() {
        return invoiceId;
    }

    public PaymentMethod getMethod() {
        return PaymentMethod.valueOf(method);
    }

    public PaymentStatus getStatus() {
        return PaymentStatus.valueOf(status);
    }

    public void setStatus(PaymentStatus status) {
        this.status = status.name();
    }

    public Integer getAmountCents() {
        return amountCents;
    }

    public String getCurrency() {
        return currency;
    }

    public String getStripePaymentIntentId() {
        return stripePaymentIntentId;
    }

    public String getStripeAccountId() {
        return stripeAccountId;
    }

    public Integer getApplicationFeeCents() {
        return applicationFeeCents;
    }

    public UUID getConfirmedByUserId() {
        return confirmedByUserId;
    }

    public void setConfirmedByUserId(UUID confirmedByUserId) {
        this.confirmedByUserId = confirmedByUserId;
    }

    public OffsetDateTime getConfirmedAt() {
        return confirmedAt;
    }

    public void setConfirmedAt(OffsetDateTime confirmedAt) {
        this.confirmedAt = confirmedAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
