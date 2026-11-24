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

    /**
     * Succeeded totals per invoice, one query for a whole page of invoices
     * instead of one per invoice. Read through {@code SucceededPayments},
     * never directly from outside payment.
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

    /**
     * Succeeded totals per month of one year, by {@code confirmed_at}: the
     * instant the money arrived, not the issue date of the invoice it pays.
     * Months and years are taken in {@code zone}, because EXTRACT on a
     * timestamptz otherwise follows the session's zone, which is UTC in a
     * container. Read through {@code SucceededPayments}.
     *
     * <p>Filters on tenant_id although RLS covers payments: these are
     * aggregates over a tenant's whole history, and a role with BYPASSRLS
     * (a local {@code postgres} login) would otherwise sum every tenant's.
     */
    @Query(value = """
        SELECT CAST(EXTRACT(MONTH FROM p.confirmed_at AT TIME ZONE :zone) AS integer) AS month,
               COALESCE(SUM(p.amount_cents), 0)                                       AS total
        FROM payments p
        WHERE p.tenant_id = :tenantId
          AND p.status = 'SUCCEEDED'
          AND EXTRACT(YEAR FROM p.confirmed_at AT TIME ZONE :zone) = :year
        GROUP BY 1
        """, nativeQuery = true)
    List<MonthlySum> sumSucceededAmountCentsByMonth(UUID tenantId, int year, String zone);

    /** The years, in {@code zone}, that hold a succeeded payment. Tenant-filtered for the same reason. */
    @Query(value = """
        SELECT DISTINCT CAST(EXTRACT(YEAR FROM p.confirmed_at AT TIME ZONE :zone) AS integer)
        FROM payments p
        WHERE p.tenant_id = :tenantId
          AND p.status = 'SUCCEEDED'
          AND p.confirmed_at IS NOT NULL
        """, nativeQuery = true)
    List<Integer> findSucceededYears(UUID tenantId, String zone);

    interface MonthlySum {
        int getMonth();
        long getTotal();
    }
}
