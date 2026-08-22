package com.photographplatform.api.billing;

import com.photographplatform.api.billing.config.BillingProperties;
import com.photographplatform.api.billing.domain.BillingInterval;
import com.photographplatform.api.tenant.domain.Plan;
import java.util.EnumMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The price table that decides what a photographer can buy and, through the
 * webhook, which tier they end up on.
 *
 * <p>Most of these are about refusing to start rather than about running.
 * Every failure mode here is silent at runtime: a missing price makes one plan
 * unbuyable, and a price Stripe knows but we do not leaves a paying customer on
 * STARTER with nothing to explain why.
 */
class BillingPropertiesTest {

    @Test
    void aDeploymentWithNoPricesRunsFineOnTheTrialAlone() {
        BillingProperties props = new BillingProperties();

        assertThatCode(props::validate).doesNotThrowAnyException();
        assertThat(props.isConfigured()).isFalse();
    }

    /**
     * The failure this guard exists for: with two of six price ids set, the
     * checkout button works for some plans and 409s for others, and a
     * subscription on an unlisted price cannot be mapped back to a tier at all.
     */
    @Test
    void partialPriceConfigurationRefusesToBoot() {
        BillingProperties props = new BillingProperties();
        props.setWebhookSecret("whsec_x");
        Map<Plan, BillingProperties.PlanPrices> prices = new EnumMap<>(Plan.class);
        prices.put(Plan.PRO, planPrices("price_pro_m", "price_pro_y"));
        props.setPrices(prices);

        assertThatThrownBy(props::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("partially configured")
            // Names what is missing — a boot failure that makes you go hunting
            // is a boot failure someone works around.
            .hasMessageContaining("starter.monthly")
            .hasMessageContaining("studio.yearly");
    }

    @Test
    void aMissingIntervalWithinAPlanAlsoCountsAsPartial() {
        BillingProperties props = new BillingProperties();
        props.setWebhookSecret("whsec_x");
        props.setPrices(fullPrices());
        props.getPrices().get(Plan.STUDIO).setYearly("  ");

        assertThatThrownBy(props::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("studio.yearly");
    }

    /**
     * Prices without a webhook secret is the worst combination available:
     * checkout works, money is taken, and every confirmation is rejected — so
     * the photographer pays and stays locked out.
     */
    @Test
    void configuredPricesWithoutAWebhookSecretRefuseToBoot() {
        BillingProperties props = new BillingProperties();
        props.setPrices(fullPrices());

        assertThatThrownBy(props::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("webhook-secret");
    }

    @Test
    void aFullyConfiguredTableBoots() {
        BillingProperties props = new BillingProperties();
        props.setWebhookSecret("whsec_x");
        props.setPrices(fullPrices());

        assertThatCode(props::validate).doesNotThrowAnyException();
        assertThat(props.isConfigured()).isTrue();
    }

    @Test
    void aZeroDayTrialRefusesToBoot() {
        BillingProperties props = new BillingProperties();
        props.setTrialDays(0);

        assertThatThrownBy(props::validate)
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("trial-days");
    }

    // ── the lookups the webhook depends on ──────────────────────────────

    @Test
    void everyPriceMapsBackToItsPlan() {
        BillingProperties props = new BillingProperties();
        props.setPrices(fullPrices());

        assertThat(props.planForPrice("price_starter_m")).contains(Plan.STARTER);
        assertThat(props.planForPrice("price_pro_y")).contains(Plan.PRO);
        assertThat(props.planForPrice("price_studio_m")).contains(Plan.STUDIO);
    }

    /**
     * Empty rather than a guess. Guessing a tier from an unknown price would
     * silently upgrade or downgrade a paying customer; the webhook logs the
     * mismatch and leaves them where they are.
     */
    @Test
    void anUnknownPriceMapsToNoPlanAtAll() {
        BillingProperties props = new BillingProperties();
        props.setPrices(fullPrices());

        assertThat(props.planForPrice("price_from_the_dashboard")).isEmpty();
        assertThat(props.planForPrice(null)).isEmpty();
        assertThat(props.planForPrice("")).isEmpty();
    }

    @Test
    void intervalsResolveToDifferentPrices() {
        BillingProperties props = new BillingProperties();
        props.setPrices(fullPrices());

        assertThat(props.priceFor(Plan.PRO, BillingInterval.MONTHLY)).contains("price_pro_m");
        assertThat(props.priceFor(Plan.PRO, BillingInterval.YEARLY)).contains("price_pro_y");
    }

    /** An unreadable interval must never commit someone to a year. */
    @Test
    void anUnreadableIntervalFallsBackToMonthly() {
        assertThat(BillingInterval.from("annually")).isEqualTo(BillingInterval.MONTHLY);
        assertThat(BillingInterval.from(null)).isEqualTo(BillingInterval.MONTHLY);
        assertThat(BillingInterval.from(" yearly ")).isEqualTo(BillingInterval.YEARLY);
    }

    private Map<Plan, BillingProperties.PlanPrices> fullPrices() {
        Map<Plan, BillingProperties.PlanPrices> prices = new EnumMap<>(Plan.class);
        prices.put(Plan.STARTER, planPrices("price_starter_m", "price_starter_y"));
        prices.put(Plan.PRO, planPrices("price_pro_m", "price_pro_y"));
        prices.put(Plan.STUDIO, planPrices("price_studio_m", "price_studio_y"));
        return prices;
    }

    private BillingProperties.PlanPrices planPrices(String monthly, String yearly) {
        BillingProperties.PlanPrices p = new BillingProperties.PlanPrices();
        p.setMonthly(monthly);
        p.setYearly(yearly);
        return p;
    }
}
