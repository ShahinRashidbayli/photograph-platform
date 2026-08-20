package com.photographplatform.api.invoice.service;

import com.photographplatform.api.invoice.domain.TaxCategory;
import com.photographplatform.api.tenant.domain.TaxMode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure line-item → totals arithmetic, kept free of persistence/PDF/HTTP so
 * the tax math can be tested in isolation. All money is integer cents;
 * fractional cents from a quantity/rate multiplication round half-up.
 */
public final class InvoiceTaxCalculator {

    private InvoiceTaxCalculator() {
    }

    public record LineInput(String description, BigDecimal quantity, int unitPriceCents, TaxCategory taxCategory) {
    }

    public record LineResult(
        String description,
        BigDecimal quantity,
        int unitPriceCents,
        TaxCategory taxCategory,
        BigDecimal taxRatePercent,
        int lineTotalCents,
        int lineTaxCents
    ) {
    }

    public record Totals(List<LineResult> lines, int subtotalCents, int taxCents, int totalCents) {
    }

    public static Totals calculate(List<LineInput> inputs, TaxMode taxMode) {
        if (inputs.isEmpty()) {
            throw new IllegalArgumentException("An invoice needs at least one line item");
        }

        int subtotal = 0;
        int tax = 0;
        List<LineResult> lines = new ArrayList<>();

        for (LineInput in : inputs) {
            BigDecimal lineTotal = in.quantity()
                .multiply(BigDecimal.valueOf(in.unitPriceCents()))
                .setScale(0, RoundingMode.HALF_UP);
            int lineTotalCents = lineTotal.intValueExact();

            BigDecimal rate = taxMode == TaxMode.KLEINUNTERNEHMER
                ? BigDecimal.ZERO
                : in.taxCategory().ratePercent();
            BigDecimal lineTax = lineTotal
                .multiply(rate)
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
            int lineTaxCents = lineTax.intValueExact();

            subtotal += lineTotalCents;
            tax += lineTaxCents;
            lines.add(new LineResult(
                in.description(), in.quantity(), in.unitPriceCents(), in.taxCategory(),
                rate, lineTotalCents, lineTaxCents
            ));
        }

        return new Totals(lines, subtotal, tax, subtotal + tax);
    }
}
