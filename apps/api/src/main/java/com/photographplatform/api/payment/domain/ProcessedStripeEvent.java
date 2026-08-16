package com.photographplatform.api.payment.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.CreationTimestamp;

/**
 * Idempotency ledger for Stripe webhook deliveries. Stripe explicitly
 * documents that the same event can be delivered more than once (retries on
 * a slow/failed response) — recording the event id before acting on it is
 * how {@code PaymentService#handleWebhookEvent} tells a genuine retry apart
 * from a new event.
 */
@Entity
@Table(name = "processed_stripe_events")
public class ProcessedStripeEvent {

    @Id
    @Column(name = "stripe_event_id", length = 255)
    private String stripeEventId;

    @CreationTimestamp
    @Column(name = "processed_at", nullable = false, updatable = false)
    private OffsetDateTime processedAt;

    protected ProcessedStripeEvent() {
    }

    public ProcessedStripeEvent(String stripeEventId) {
        this.stripeEventId = stripeEventId;
    }

    public String getStripeEventId() {
        return stripeEventId;
    }

    public OffsetDateTime getProcessedAt() {
        return processedAt;
    }
}
