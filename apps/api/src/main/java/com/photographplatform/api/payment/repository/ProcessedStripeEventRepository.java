package com.photographplatform.api.payment.repository;

import com.photographplatform.api.payment.domain.ProcessedStripeEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProcessedStripeEventRepository extends JpaRepository<ProcessedStripeEvent, String> {

    /**
     * Atomically claims a Stripe event id: inserts it and returns 1, or does
     * nothing and returns 0 if it's already there. Using the PK's uniqueness
     * as the atomicity boundary (rather than {@code existsById} followed by a
     * later {@code save}) is what closes the race where two concurrent
     * deliveries of the same event both pass an existence check before
     * either has inserted — see {@code PaymentService#applyWebhookEvent}.
     */
    @Modifying
    @Query(value = """
        INSERT INTO processed_stripe_events (stripe_event_id) VALUES (:eventId)
        ON CONFLICT (stripe_event_id) DO NOTHING
        """, nativeQuery = true)
    int tryClaim(String eventId);
}
