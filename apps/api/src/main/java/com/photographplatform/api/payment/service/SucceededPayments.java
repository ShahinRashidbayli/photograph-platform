package com.photographplatform.api.payment.service;

import com.photographplatform.api.common.util.BusinessZone;
import com.photographplatform.api.payment.repository.PaymentRepository;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * How much money has actually arrived, against an invoice or in a month: the
 * sum of SUCCEEDED payments. Invoice's {@code Settlement} and {@code
 * SettlementPeriods} read it from here instead of from {@link
 * PaymentRepository}, so which payments count is decided once, in payment
 * (ADR-004 §1).
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

    /**
     * Money that arrived in each Europe/Berlin month (1-12) of one year, on
     * whatever invoice it was paid against (ADR-004 §3, cash basis). A
     * payment confirmed at 00:30 on the 1st is that month's, although it is
     * still the month before in UTC. A month with nothing is absent.
     */
    public Map<Integer, Long> totalCentsByMonth(UUID tenantId, int year) {
        return paymentRepository.sumSucceededAmountCentsByMonth(tenantId, year, BusinessZone.ID.getId()).stream()
            .collect(Collectors.toMap(
                PaymentRepository.MonthlySum::getMonth, PaymentRepository.MonthlySum::getTotal));
    }

    /** The Europe/Berlin years in which money arrived, in no particular order. */
    public List<Integer> years(UUID tenantId) {
        return paymentRepository.findSucceededYears(tenantId, BusinessZone.ID.getId());
    }
}
