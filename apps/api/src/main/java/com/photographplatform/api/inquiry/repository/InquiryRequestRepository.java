package com.photographplatform.api.inquiry.repository;

import com.photographplatform.api.inquiry.domain.InquiryRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Tenant-scoped: {@code inquiry_requests} carries a {@code tenant_id} column
 * enforced by Postgres Row-Level Security (see {@code V11__tenant_rls.sql}),
 * so every query below is already confined to the caller's photographer at
 * the database layer. No explicit tenant filter is needed in the query
 * methods here.
 */
public interface InquiryRequestRepository extends JpaRepository<InquiryRequest, UUID> {

    /*
     * Slice, not Page: the inbox endpoint answers a JSON array and never
     * carried the totals a Page pays a second COUNT query to produce. Same
     * reasoning as BookingRepository.
     */

    Slice<InquiryRequest> findAllBy(Pageable pageable);

    Slice<InquiryRequest> findByStatus(String status, Pageable pageable);

    /**
     * The customer's own inquiries. Scoped by customer id on top of the RLS
     * tenant isolation, so one customer can never read another's request even
     * though they share the same photographer.
     */
    Slice<InquiryRequest> findByCustomerId(UUID customerId, Pageable pageable);

    /** Every inquiry one customer account filed, unpaged — for Art. 17 erasure. */
    List<InquiryRequest> findByCustomerId(UUID customerId);
}
