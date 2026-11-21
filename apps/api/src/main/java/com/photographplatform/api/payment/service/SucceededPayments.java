package com.photographplatform.api.payment.service;

import com.photographplatform.api.payment.repository.PaymentRepository;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * How much money has actually arrived against an invoice: the sum of its
 * SUCCEEDED payments. Invoice's {@code Settlement} reads it from here instead
 * of from {@link PaymentRepository}, so which payments count is decided once,
 * in payment (ADR-004 §1).
 *
 * <p>Its own bean rather than two methods on {@link PaymentService}: payment
 * takes money through {@code Settlement}, and {@code Settlement} needs these
 * totals, so putting them on {@code PaymentService} would be a constructor
 * cycle.
 */
@Service
public class SucceededPayments {

    private final PaymentRepository paymentRepository;

    public SucceededPayments(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    public long totalCents(UUID invoiceId) {
        return paymentRepository.sumSucceededAmountCents(invoiceId);
    }

    /**
     * One grouped query for a whole page of invoices. An invoice with no
     * succeeded payment is absent from the map, not present with 0.
     */
    public Map<UUID, Long> totalCentsByInvoice(Collection<UUID> invoiceIds) {
        if (invoiceIds.isEmpty()) {
            return Map.of();
        }
        return paymentRepository.sumSucceededAmountCentsGroupedByInvoiceId(invoiceIds).stream()
            .collect(Collectors.toMap(
                PaymentRepository.SucceededSum::getInvoiceId, PaymentRepository.SucceededSum::getTotal));
    }
}
