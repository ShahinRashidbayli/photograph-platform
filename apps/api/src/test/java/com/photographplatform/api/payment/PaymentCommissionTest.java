package com.photographplatform.api.payment;

import com.photographplatform.api.payment.config.PaymentProperties;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The platform's cut of a collected payment (PRICING.md §4/§7.1, decided
 * 2026-07-17): 2% on Starter, nothing on Pro or Studio. This is the number
 * that ends up in Stripe's {@code application_fee_amount}, so it is money —
 * the rounding and the guard rails matter more than the happy path.
 */
class PaymentCommissionTest {

    private final PaymentProperties.Commission commission = new PaymentProperties.Commission();

    @Test
    void starterPaysTwoPercent() {
        // A €1,200 wedding deposit — the example PRICING.md reasons about.
        assertThat(commission.feeCents(120_000L, "STARTER")).isEqualTo(2_400L);
    }

    @Test
    void proAndStudioPayNothing() {
        assertThat(commission.feeCents(120_000L, "PRO")).isZero();
        assertThat(commission.feeCents(120_000L, "STUDIO")).isZero();
    }

    @Test
    void planMatchingIgnoresCaseAndSurroundingWhitespace() {
        assertThat(commission.bpsForPlan(" pro ")).isZero();
        assertThat(commission.bpsForPlan("Studio")).isZero();
    }

    /**
     * An unrecognised plan must bill, not go free. The alternative — defaulting
     * to 0 bps — means a typo'd or newly-added plan name silently waives the
     * commission on every payment made under it, and nothing would ever
     * surface that except the revenue not arriving.
     */
    @Test
    void unknownOrMissingPlanFallsBackToTheStarterRate() {
        assertThat(commission.bpsForPlan("ENTERPRISE")).isEqualTo(200);
        assertThat(commission.bpsForPlan(null)).isEqualTo(200);
        assertThat(commission.bpsForPlan("")).isEqualTo(200);
    }

    @Test
    void feeRoundsHalfUpToWholeCents() {
        // 2% of 1,275 = 25.5 cents.
        assertThat(commission.feeCents(1_275L, "STARTER")).isEqualTo(26L);
        // 2% of 1,225 = 24.5 cents.
        assertThat(commission.feeCents(1_225L, "STARTER")).isEqualTo(25L);
    }

    @Test
    void nonPositiveAmountsProduceNoFee() {
        assertThat(commission.feeCents(0L, "STARTER")).isZero();
        assertThat(commission.feeCents(-500L, "STARTER")).isZero();
    }

    /**
     * Stripe rejects a PaymentIntent whose application fee is not less than
     * the charge, and a fee equal to the amount would mean the photographer
     * collected nothing from their own client. Only reachable via a
     * misconfigured rate, which is exactly when a hard cap earns its keep.
     */
    @Test
    void feeCanNeverReachTheChargeTotal() {
        PaymentProperties.Commission absurd = new PaymentProperties.Commission();
        absurd.setStarterBps(20_000); // 200%
        assertThat(absurd.feeCents(10_000L, "STARTER")).isEqualTo(9_999L);
    }
}
