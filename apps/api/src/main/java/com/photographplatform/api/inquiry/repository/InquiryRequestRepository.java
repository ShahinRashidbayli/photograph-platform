package com.photographplatform.api.inquiry.repository;

import com.photographplatform.api.inquiry.domain.InquiryRequest;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Tenant-scoped: {@code inquiry_requests} lives in the tenant schema, so the
 * routing data source (search_path set per request from the JWT's tenant_id)
 * already confines every query below to the caller's photographer. No explicit
 * tenant column or filter is needed — or possible.
 */
public interface InquiryRequestRepository extends JpaRepository<InquiryRequest, UUID> {

    Page<InquiryRequest> findByStatus(String status, Pageable pageable);

    /**
     * The customer's own inquiries. Scoped by customer id on top of the tenant
     * search_path, so one customer can never read another's request even though
     * they share the photographer's schema.
     */
    Page<InquiryRequest> findByCustomerId(UUID customerId, Pageable pageable);
}
