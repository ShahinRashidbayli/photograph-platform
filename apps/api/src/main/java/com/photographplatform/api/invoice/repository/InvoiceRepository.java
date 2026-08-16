package com.photographplatform.api.invoice.repository;

import com.photographplatform.api.invoice.domain.Invoice;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {

    Page<Invoice> findAllByOrderByIssuedAtDesc(Pageable pageable);

    List<Invoice> findByBookingIdOrderByIssuedAtDesc(UUID bookingId);

    List<Invoice> findByBookingIdInOrderByIssuedAtDesc(Collection<UUID> bookingIds);

    List<Invoice> findByIssueYearOrderByIssuedAtAsc(Integer issueYear);
}
