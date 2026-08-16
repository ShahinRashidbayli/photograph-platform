package com.photographplatform.api.invoice;

import com.photographplatform.api.invoice.domain.TaxCategory;
import com.photographplatform.api.invoice.service.InvoiceTaxCalculator;
import com.photographplatform.api.tenant.domain.TaxMode;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InvoiceTaxCalculatorTest {

    @Test
    void kleinunternehmerChargesNoTaxRegardlessOfCategory() {
        var totals = InvoiceTaxCalculator.calculate(
            List.of(line("Hochzeitspaket", 180_000, TaxCategory.STANDARD)),
            TaxMode.KLEINUNTERNEHMER
        );

        assertThat(totals.subtotalCents()).isEqualTo(180_000);
        assertThat(totals.taxCents()).isZero();
        assertThat(totals.totalCents()).isEqualTo(180_000);
        assertThat(totals.lines().get(0).taxRatePercent()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void regelbesteuerungAppliesStandardNineteenPercent() {
        var totals = InvoiceTaxCalculator.calculate(
            List.of(line("Fotoshooting", 100_000, TaxCategory.STANDARD)),
            TaxMode.REGELBESTEUERUNG
        );

        assertThat(totals.subtotalCents()).isEqualTo(100_000);
        assertThat(totals.taxCents()).isEqualTo(19_000);
        assertThat(totals.totalCents()).isEqualTo(119_000);
    }

    @Test
    void regelbesteuerungAppliesReducedSevenPercent() {
        var totals = InvoiceTaxCalculator.calculate(
            List.of(line("Fotobuch", 10_000, TaxCategory.REDUCED)),
            TaxMode.REGELBESTEUERUNG
        );

        assertThat(totals.taxCents()).isEqualTo(700);
        assertThat(totals.totalCents()).isEqualTo(10_700);
    }

    @Test
    void exemptCategoryUnderRegelbesteuerungChargesNoTax() {
        var totals = InvoiceTaxCalculator.calculate(
            List.of(line("Reisekosten", 5_000, TaxCategory.EXEMPT)),
            TaxMode.REGELBESTEUERUNG
        );

        assertThat(totals.taxCents()).isZero();
        assertThat(totals.totalCents()).isEqualTo(5_000);
    }

    @Test
    void multipleLinesSumIndependently() {
        var totals = InvoiceTaxCalculator.calculate(
            List.of(
                line("Hochzeitspaket", 180_000, TaxCategory.STANDARD),
                line("Fotobuch", 10_000, TaxCategory.REDUCED),
                line("Anzahlung-Verrechnung", -50_000, TaxCategory.STANDARD)
            ),
            TaxMode.REGELBESTEUERUNG
        );

        // 180000*1.19 + 10000*1.07 + (-50000)*1.19 = 214200 + 10700 - 59500
        assertThat(totals.subtotalCents()).isEqualTo(180_000 + 10_000 - 50_000);
        assertThat(totals.taxCents()).isEqualTo(34_200 + 700 - 9_500);
        assertThat(totals.totalCents()).isEqualTo(totals.subtotalCents() + totals.taxCents());
    }

    @Test
    void fractionalQuantityRoundsHalfUp() {
        // 1.5 * 333 cents = 499.5 -> rounds to 500
        var totals = InvoiceTaxCalculator.calculate(
            List.of(new InvoiceTaxCalculator.LineInput("Stunden", new BigDecimal("1.5"), 333, TaxCategory.EXEMPT)),
            TaxMode.REGELBESTEUERUNG
        );

        assertThat(totals.lines().get(0).lineTotalCents()).isEqualTo(500);
    }

    @Test
    void emptyLineListIsRejected() {
        assertThatThrownBy(() -> InvoiceTaxCalculator.calculate(List.of(), TaxMode.KLEINUNTERNEHMER))
            .isInstanceOf(IllegalArgumentException.class);
    }

    private static InvoiceTaxCalculator.LineInput line(String description, int unitPriceCents, TaxCategory category) {
        return new InvoiceTaxCalculator.LineInput(description, BigDecimal.ONE, unitPriceCents, category);
    }
}
