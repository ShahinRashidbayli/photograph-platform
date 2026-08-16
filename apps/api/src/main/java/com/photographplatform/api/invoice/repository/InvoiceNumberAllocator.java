package com.photographplatform.api.invoice.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/**
 * Hands out gap-free, per-tenant-per-year invoice sequence numbers.
 *
 * <p>Deliberately not a {@code JpaRepository} — {@code invoice_counters} has
 * no corresponding entity, since nothing ever needs to read it as an object;
 * the single atomic upsert below is its entire access pattern.
 */
@Repository
public class InvoiceNumberAllocator {

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Atomically allocates and returns the next sequence number for a
     * tenant+year. {@code INSERT .. ON CONFLICT DO UPDATE} takes a row lock
     * on the counter row for the duration of the transaction, so two
     * concurrent invoice creations serialize instead of racing a
     * read-then-write {@code MAX(number)+1} — the exact race the spec
     * (§10.4) calls out as a GoBD violation waiting to happen.
     */
    public int nextSequenceNumber(UUID tenantId, int issueYear) {
        Object result = entityManager.createNativeQuery("""
                INSERT INTO invoice_counters (tenant_id, issue_year, next_number)
                VALUES (:tenantId, :issueYear, 2)
                ON CONFLICT (tenant_id, issue_year)
                DO UPDATE SET next_number = invoice_counters.next_number + 1
                RETURNING next_number - 1
                """)
            .setParameter("tenantId", tenantId)
            .setParameter("issueYear", issueYear)
            .getSingleResult();
        return ((Number) result).intValue();
    }
}
