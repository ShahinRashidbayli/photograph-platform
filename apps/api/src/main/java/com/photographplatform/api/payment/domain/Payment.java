package com.photographplatform.api.payment.domain;

import com.photographplatform.api.common.domain.RevenueSource;
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

    /**
     * Which business this payment belongs to — see {@link
     * com.photographplatform.api.invoice.domain.Invoice#getSource()} and
     * ADR-003 §6. Fixed at {@code CLIENT_BOOKING}: everything this module
     * charges today is a client paying their photographer.
     *
     * <p>It matters more here than on the invoice, because {@code
     * application_fee_cents} beside it will one day be non-zero for two
     * unrelated reasons — the Starter commission on a client's payment, and the
     * platform's cut of a rental between two photographers. Without this
     * column those are indistinguishable after the fact.
     */
    @Column(nullable = false, updatable = false, length = 30)
    private String source = RevenueSource.CLIENT_BOOKING.name();

    /**
     * Updatable, by exactly one writer: {@link #correctAmountToReceived}.
     *
     * <p>This was {@code updatable = false}, which read as immutability but was
     * not enforced anywhere — {@code V14__payments.sql} says outright that a
     * payment row is "operational state tracking whether it's been collected",
     * not a GoBD document, and deliberately carries no immutability trigger
     * (unlike {@code invoices}, which does). So the flag protected nothing; it
     * only meant Hibernate silently dropped the correction from the UPDATE and
     * the settlement webhook appeared to reconcile amounts while changing
     * nothing at all.
     *
     * <p>A silently ignored write on the money path is worse than no write: it
     * looks handled in code review and in the logs.
     */
    @Column(name = "amount_cents", nullable = false)
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

    public RevenueSource getSource() {
        return RevenueSource.valueOf(source);
    }

    public Integer getAmountCents() {
        return amountCents;
    }

    /**
     * Corrects the amount to what Stripe reports as actually received.
     *
     * <p>Deliberately named for the one thing that may do it, rather than being
     * a plain setter: until settlement the amount is our <em>request</em> (the
     * balance outstanding when the intent was minted) and nothing should be
     * rewriting it. The only authority on what really arrived is the settlement
     * webhook, and it needs to say so — a partial capture recorded at the
     * requested amount marks an invoice paid for money that never landed.
     *
     * @see com.photographplatform.api.payment.service.StripeWebhookService
     */
    public void correctAmountToReceived(int receivedCents) {
        this.amountCents = receivedCents;
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
