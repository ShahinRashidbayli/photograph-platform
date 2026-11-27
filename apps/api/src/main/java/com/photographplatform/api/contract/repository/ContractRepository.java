package com.photographplatform.api.contract.repository;

import com.photographplatform.api.contract.domain.Contract;
import com.photographplatform.api.contract.domain.ContractStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ContractRepository extends JpaRepository<Contract, UUID> {

    /**
     * Ownership is in the query, not in an {@code if} after it. Loading by id
     * and then comparing the tenant leaves the wrong row in the persistence
     * context and invites the check being dropped by the next caller.
     */
    Optional<Contract> findByIdAndTenantId(UUID id, UUID tenantId);

    List<Contract> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    List<Contract> findByBookingIdAndTenantIdOrderByCreatedAtDesc(UUID bookingId, UUID tenantId);

    List<Contract> findByBookingIdInAndTenantIdOrderByCreatedAtDesc(Collection<UUID> bookingIds, UUID tenantId);

    /**
     * The customer's own contracts.
     *
     * <p>Matched on the recipient address rather than a user id because a
     * booking taken over the phone gets a contract before its customer has an
     * account — the same reason {@code bookings.customer_user_id} is nullable
     * (V31). Lower-cased on both sides so it agrees with
     * {@code idx_contracts_recipient_email}, which indexes {@code LOWER(...)}:
     * a case-sensitive comparison here would silently stop using that index.
     *
     * <p>Drafts are excluded outright. A draft is the photographer's private
     * working copy, and the customer must never be shown one.
     */
    @Query("""
        SELECT c FROM Contract c
        WHERE LOWER(c.recipientEmail) = LOWER(:email)
          AND c.status <> com.photographplatform.api.contract.domain.ContractStatus.DRAFT
        ORDER BY c.createdAt DESC
        """)
    List<Contract> findVisibleToCustomer(@Param("email") String email);

    /**
     * One contract, by id, only if this address is its recipient and it has
     * left DRAFT. The customer-side equivalent of
     * {@link #findByIdAndTenantId} — same reason for putting the rule in the
     * query.
     */
    @Query("""
        SELECT c FROM Contract c
        WHERE c.id = :id
          AND LOWER(c.recipientEmail) = LOWER(:email)
          AND c.status <> com.photographplatform.api.contract.domain.ContractStatus.DRAFT
        """)
    Optional<Contract> findVisibleToCustomer(@Param("id") UUID id, @Param("email") String email);

    boolean existsByBookingIdAndStatusIn(UUID bookingId, List<ContractStatus> statuses);

    /** Contracts on these bookings or addressed to this person, for Art. 17 erasure. */
    List<Contract> findByBookingIdInOrRecipientEmailIgnoreCase(Collection<UUID> bookingIds, String email);
}
