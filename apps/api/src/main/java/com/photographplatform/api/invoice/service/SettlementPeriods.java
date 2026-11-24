package com.photographplatform.api.invoice.service;

import com.photographplatform.api.invoice.domain.Invoice;
import com.photographplatform.api.invoice.domain.InvoiceSettlement;
import com.photographplatform.api.invoice.domain.YearSettlement;
import com.photographplatform.api.invoice.repository.InvoiceRepository;
import com.photographplatform.api.payment.service.SucceededPayments;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.SortedSet;
import java.util.TreeSet;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Which period an invoice's money counts in (ADR-004 §3): Invoiced and
 * Collected per Europe/Berlin month. The reports ask here instead of summing
 * invoice and payment rows themselves, which is how analytics came to count
 * January money in December.
 *
 * <ul>
 *   <li>Invoiced is every issued document in its issue month, the way the
 *       DATEV export books it: a Storniert original stays +X, its Storno is
 *       −X in its own month.</li>
 *   <li>Collected is cash basis, as in an EÜR: a payment counts in the month
 *       it succeeded, whichever invoice it paid. Payment decides which
 *       payments count and when they arrived ({@link SucceededPayments}).</li>
 * </ul>
 *
 * <p>The year's invoices are loaded rather than summed in SQL, from the query
 * the DATEV export reads, and bucketed by {@link InvoiceDate}, the same date
 * the export writes as Belegdatum, so the report cannot drift from the file the
 * accountant receives. Outstanding is taken from {@link Settlement}'s own
 * per-invoice rule rather than worked out a second time here.
 *
 * <p>The tenant is passed in and filtered on explicitly: these are sums over a
 * tenant's whole year, and RLS alone does not hold for a role with BYPASSRLS.
 */
@Service
public class SettlementPeriods {

    private final InvoiceRepository invoiceRepository;
    private final Settlement settlement;
    private final SucceededPayments succeededPayments;

    public SettlementPeriods(
        InvoiceRepository invoiceRepository, Settlement settlement, SucceededPayments succeededPayments) {
        this.invoiceRepository = invoiceRepository;
        this.settlement = settlement;
        this.succeededPayments = succeededPayments;
    }

    /**
     * The years with anything Invoiced or Collected, newest first. A year
     * whose only entry is January's payment for a December invoice is one.
     */
    @Transactional(readOnly = true)
    public List<Integer> years(UUID tenantId) {
        SortedSet<Integer> years = new TreeSet<>(Comparator.reverseOrder());
        years.addAll(invoiceRepository.findIssueYearsByTenantId(tenantId));
        years.addAll(succeededPayments.years(tenantId));
        return List.copyOf(years);
    }

    @Transactional(readOnly = true)
    public YearSettlement ofYear(UUID tenantId, int year) {
        List<Invoice> invoices = invoiceRepository.findByTenantIdAndIssueYear(tenantId, year);
        long[] invoicedByMonth = new long[12];
        for (Invoice invoice : invoices) {
            invoicedByMonth[InvoiceDate.of(invoice.getIssuedAt()).getMonthValue() - 1] += invoice.getTotalCents();
        }
        Map<Integer, Long> collectedByMonth = succeededPayments.totalCentsByMonth(tenantId, year);

        List<YearSettlement.Month> months = new ArrayList<>(12);
        for (int m = 1; m <= 12; m++) {
            months.add(new YearSettlement.Month(m, invoicedByMonth[m - 1], collectedByMonth.getOrDefault(m, 0L)));
        }

        List<Invoice> live = invoices.stream().filter(Invoice::isLive).toList();
        long liveTotal = live.stream().mapToLong(Invoice::getTotalCents).sum();
        long outstanding = settlement.ofInvoices(live).values().stream()
            .mapToLong(InvoiceSettlement::outstandingCents)
            .sum();

        return new YearSettlement(months, live.size(), liveTotal, outstanding);
    }
}
