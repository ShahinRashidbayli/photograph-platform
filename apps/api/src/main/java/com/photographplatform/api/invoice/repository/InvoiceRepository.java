package com.photographplatform.api.invoice.repository;

import com.photographplatform.api.invoice.domain.Invoice;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {

    /**
     * The invoice, locked for the rest of the transaction — the serialisation
     * point for everything that collects money against it.
     *
     * <p>Both payment paths decide from the invoice's outstanding balance and
     * then write, and neither decision survives another writer landing in
     * between: two callers can each mint a live PaymentIntent for the same
     * balance, or each record a manual payment that only fits if the other one
     * doesn't exist. Locking the invoice row makes those two operations
     * mutually exclusive per invoice, which is the narrowest scope that
     * actually covers them — nothing across invoices contends.
     *
     * <p>{@code lock.timeout = 0} is Hibernate's spelling of {@code FOR UPDATE
     * NOWAIT}. Waiting would be worse than failing here: the Stripe round-trip
     * happens inside this lock, so a queued second request would block for the
     * length of someone else's network call and most likely time out the HTTP
     * request anyway. Failing immediately lets the caller say something true —
     * "a payment is already being processed, try again in a moment" — instead
     * of hanging. {@code Settlement#lockForPayment}, the only caller, translates
     * the resulting {@code PessimisticLockingFailureException} into a 409.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "0"))
    @Query("SELECT i FROM Invoice i WHERE i.id = :id")
    Optional<Invoice> findByIdForPayment(UUID id);

    List<Invoice> findByBookingIdOrderByIssuedAtDesc(UUID bookingId);

    List<Invoice> findByBookingIdInOrderByIssuedAtDesc(Collection<UUID> bookingIds);

    List<Invoice> findByIssueYearOrderByIssuedAtAsc(Integer issueYear);

    /**
     * The same documents the DATEV export books for a year, with the tenant
     * spelled out: {@code SettlementPeriods} sums a tenant's whole year from
     * these, and a role with BYPASSRLS (a local {@code postgres} login) would
     * otherwise hand it every tenant's invoices.
     */
    List<Invoice> findByTenantIdAndIssueYear(UUID tenantId, Integer issueYear);

    /** The years a tenant has issued anything in. issue_year is the Europe/Berlin year (InvoiceDate). */
    @Query("SELECT DISTINCT i.issueYear FROM Invoice i WHERE i.tenantId = :tenantId")
    List<Integer> findIssueYearsByTenantId(UUID tenantId);

    /** Invoices for these bookings or issued to this person — reported, never touched, by Art. 17 erasure. */
    long countByBookingIdInOrBuyerEmailIgnoreCase(Collection<UUID> bookingIds, String email);
}
