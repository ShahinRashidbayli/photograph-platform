package com.photographplatform.api.invoice.service;

import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.ErasureSubject;
import com.photographplatform.api.common.privacy.PersonalDataEraser;
import com.photographplatform.api.common.privacy.RetentionBasis;
import com.photographplatform.api.invoice.repository.InvoiceRepository;
import java.util.List;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Takes part in erasure only to say what it keeps.
 *
 * <p>Invoices must be kept for ten years (§147 AO, §14b UStG) and are immutable
 * under GoBD — a database trigger refuses any change. Erasure leaves them, and
 * their payments, exactly as issued; the photographer is told how many, and
 * why, so they can answer the person who asked.
 */
@Component
@Order(800)
@Transactional(propagation = Propagation.MANDATORY)
public class InvoiceRetentionReporter implements PersonalDataEraser {

    private final InvoiceRepository invoiceRepository;

    public InvoiceRetentionReporter(InvoiceRepository invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }

    @Override
    public List<ErasureOutcome> erase(ErasureSubject subject) {
        long kept = invoiceRepository.countByBookingIdInOrBuyerEmailIgnoreCase(subject.bookingIds(), subject.email());
        return List.of(ErasureOutcome.retained("invoices", Math.toIntExact(kept), RetentionBasis.TAX_RECORDS));
    }
}
