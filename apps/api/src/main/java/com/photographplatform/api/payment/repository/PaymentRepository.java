package com.photographplatform.api.payment.repository;

import com.photographplatform.api.payment.domain.Payment;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    List<Payment> findByInvoiceIdOrderByCreatedAtDesc(UUID invoiceId);

    Optional<Payment> findByStripePaymentIntentId(String stripePaymentIntentId);

    Optional<Payment> findFirstByInvoiceIdAndStatusAndStripePaymentIntentIdIsNotNullOrderByCreatedAtDesc(
        UUID invoiceId, String status);

    @Query("""
        SELECT COALESCE(SUM(p.amountCents), 0) FROM Payment p
        WHERE p.invoiceId = :invoiceId AND p.status = 'SUCCEEDED'
        """)
    long sumSucceededAmountCents(UUID invoiceId);

    /**
     * Batch form of {@link #sumSucceededAmountCents(UUID)} — one query for a
     * whole page of invoices instead of one per invoice, for callers (e.g.
     * {@code BookingPaymentStateResolver#resolveAll}) resolving payment state
     * for a list of bookings rather than a single one.
     */
    @Query("""
        SELECT p.invoiceId AS invoiceId, COALESCE(SUM(p.amountCents), 0) AS total FROM Payment p
        WHERE p.invoiceId IN :invoiceIds AND p.status = 'SUCCEEDED'
        GROUP BY p.invoiceId
        """)
    List<SucceededSum> sumSucceededAmountCentsGroupedByInvoiceId(Collection<UUID> invoiceIds);

    interface SucceededSum {
        UUID getInvoiceId();
        long getTotal();
    }
}
