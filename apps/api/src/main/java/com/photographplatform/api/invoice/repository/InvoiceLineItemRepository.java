package com.photographplatform.api.invoice.repository;

import com.photographplatform.api.invoice.domain.InvoiceLineItem;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceLineItemRepository extends JpaRepository<InvoiceLineItem, UUID> {

    List<InvoiceLineItem> findByInvoiceIdOrderBySortOrderAsc(UUID invoiceId);

    /**
     * Batch form of {@link #findByInvoiceIdOrderBySortOrderAsc(UUID)} — one
     * query for a whole booking's invoice history instead of one per invoice.
     * Callers group by {@code invoiceId}; the secondary sort keeps each
     * group's line order intact.
     */
    List<InvoiceLineItem> findByInvoiceIdInOrderByInvoiceIdAscSortOrderAsc(Collection<UUID> invoiceIds);
}
