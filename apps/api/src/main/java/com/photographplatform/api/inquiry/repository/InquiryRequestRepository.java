package com.photographplatform.api.inquiry.repository;

import com.photographplatform.api.inquiry.domain.InquiryRequest;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Tenant-scoped: {@code inquiry_requests} carries a {@code tenant_id} column
 * enforced by Postgres Row-Level Security (see {@code V11__tenant_rls.sql}),
 * so every query below is already confined to the caller's photographer at
 * the database layer. No explicit tenant filter is needed in the query
 * methods here.
 */
public interface InquiryRequestRepository extends JpaRepository<InquiryRequest, UUID> {

    Page<InquiryRequest> findByStatus(String status, Pageable pageable);

    /**
     * The customer's own inquiries. Scoped by customer id on top of the RLS
     * tenant isolation, so one customer can never read another's request even
     * though they share the same photographer.
     */
    Page<InquiryRequest> findByCustomerId(UUID customerId, Pageable pageable);
}
