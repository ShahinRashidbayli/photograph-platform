package com.photographplatform.api.billing.config;

import com.photographplatform.api.billing.domain.BillingInterval;
import com.photographplatform.api.tenant.domain.Plan;
import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Fotolio's own subscription with the photographer.
 *
 * <p>Not to be confused with {@code app.stripe} / {@code PaymentProperties},
 * which configures the Connect flow where a photographer's <em>client</em> pays
 * them and we take a commission. This one is the €19/€39/€79 the photographer
 * pays us — a different Stripe object model (Customers and Subscriptions on the
 * platform account, not charges on a connected one) and a different webhook.
 */
@Component
@ConfigurationProperties(prefix = "app.billing")
public class BillingProperties {

    /**
     * Length of the free trial, in days. The landing page sells "14 Tage
     * kostenlos starten"; this is the number that has to match it, and it is
     * configurable because the copy is a marketing decision that will change
     * more often than the code.
     */
    private int trialDays = 14;

    /**
     * Lets a studio owner change their own plan without paying for it.
     *
     * <p><strong>Development only, and off unless someone deliberately turns it
     * on.</strong> Self-service upgrades normally go through Stripe Checkout,
     * which is hidden until the six price ids are configured — deliberately,
     * because a tier is something a customer pays for. That leaves no way to
     * exercise a paid tier on a machine with no Stripe account, which is what
     * this exists for.
     *
     * <p>Turning it on anywhere a real subscription is the source of truth
     * gives every customer every tier for free. {@code BillingService} logs a
     * warning at startup when it is enabled, so an environment that switched it
     * on by accident says so in its own logs.
     */
    private boolean devPlanSwitch = false;

    /**
     * Signing secret for the subscription webhook.
     *
     * <p>Deliberately its own secret, separate from {@code
     * app.stripe.webhook-secret}. The two endpoints carry different traffic —
     * this one is subscription lifecycle on the platform account, the other is
     * charges on connected accounts — and giving them one secret means
     * rotating it for one breaks the other, silently, with money involved on
     * both sides.
     */
    private String webhookSecret;

    private Map<Plan, PlanPrices> prices = new EnumMap<>(Plan.class);

    public boolean isDevPlanSwitch() {
        return devPlanSwitch;
    }

    public void setDevPlanSwitch(boolean devPlanSwitch) {
        this.devPlanSwitch = devPlanSwitch;
    }

    public int getTrialDays() {
        return trialDays;
    }

    public void setTrialDays(int trialDays) {
        this.trialDays = trialDays;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = webhookSecret;
    }

    public Map<Plan, PlanPrices> getPrices() {
        return prices;
    }

    public void setPrices(Map<Plan, PlanPrices> prices) {
        this.prices = prices;
    }

    /** True once this deployment can actually sell a subscription. */
    public boolean isConfigured() {
        return configuredPriceCount() > 0;
    }

    public Optional<String> priceFor(Plan plan, BillingInterval interval) {
        PlanPrices planPrices = prices.get(plan);
        if (planPrices == null) {
            return Optional.empty();
        }
        String priceId = interval == BillingInterval.YEARLY
            ? planPrices.getYearly()
            : planPrices.getMonthly();
        return priceId == null || priceId.isBlank() ? Optional.empty() : Optional.of(priceId);
    }

    /**
     * Reverse lookup: which plan does this Stripe price belong to?
     *
     * <p>This is how a subscription decides a tenant's tier. The plan must
     * come from what they actually pay for — never from the registration
     * request, which is what {@code RegisterRequest}'s javadoc warned about.
     */
    public Optional<Plan> planForPrice(String priceId) {
        if (priceId == null || priceId.isBlank()) {
            return Optional.empty();
        }
        return prices.entrySet().stream()
            .filter(entry -> priceId.equals(entry.getValue().getMonthly())
                || priceId.equals(entry.getValue().getYearly()))
            .map(Map.Entry::getKey)
            .findFirst();
    }

    /**
     * Refuses to start half-configured.
     *
     * <p>Billing may legitimately be absent — a deployment that has not opened
     * a Stripe account yet still runs, on the trial alone. What must not happen
     * is <em>partial</em> configuration: with two of six price ids set, the
     * checkout button works for some plans and 409s for others, and a
     * subscription that comes back on an unmapped price cannot be resolved to a
     * tier at all, leaving a paying customer on STARTER with no trace of why.
     */
    @PostConstruct
    public void validate() {
        if (trialDays < 1) {
            throw new IllegalStateException(
                "app.billing.trial-days must be at least 1 — a zero-day trial would put every new "
                    + "signup into the read-only lock before they saw a single screen.");
        }
        int configured = configuredPriceCount();
        int expected = Plan.values().length * 2;
        if (configured > 0 && configured < expected) {
            throw new IllegalStateException(
                "app.billing.prices is partially configured (" + configured + " of " + expected
                    + " price ids). Set every plan's monthly and yearly price, or leave them all "
                    + "blank to run without subscriptions. A partial table means some plans cannot "
                    + "be bought and some subscriptions cannot be mapped back to a tier. Missing: "
                    + String.join(", ", missingPrices()));
        }
        if (configured > 0 && (webhookSecret == null || webhookSecret.isBlank())) {
            throw new IllegalStateException(
                "app.billing.prices is configured but app.billing.webhook-secret is not. Without it "
                    + "every subscription webhook is rejected, so photographers would be charged and "
                    + "never leave the read-only lock.");
        }
    }

    private int configuredPriceCount() {
        int count = 0;
        for (Plan plan : Plan.values()) {
            for (BillingInterval interval : BillingInterval.values()) {
                if (priceFor(plan, interval).isPresent()) {
                    count++;
                }
            }
        }
        return count;
    }

    private List<String> missingPrices() {
        List<String> missing = new ArrayList<>();
        for (Plan plan : Plan.values()) {
            for (BillingInterval interval : BillingInterval.values()) {
                if (priceFor(plan, interval).isEmpty()) {
                    // Locale.ROOT, not the platform locale: under Turkish
                    // rules 'I' lowercases to dotless 'ı', so this message
                    // would name a config key ("studıo.yearly") that does not
                    // exist and cannot be grepped for — sending whoever hit
                    // the boot failure hunting. Same hazard BookingStatus#parse
                    // documents.
                    missing.add(plan.name().toLowerCase(Locale.ROOT)
                        + "." + interval.name().toLowerCase(Locale.ROOT));
                }
            }
        }
        return missing;
    }

    /** One tier's Stripe price ids. */
    public static class PlanPrices {

        private String monthly;
        private String yearly;

        public String getMonthly() {
            return monthly;
        }

        public void setMonthly(String monthly) {
            this.monthly = monthly;
        }

        public String getYearly() {
            return yearly;
        }

        public void setYearly(String yearly) {
            this.yearly = yearly;
        }
    }
}
