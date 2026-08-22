package com.photographplatform.api.billing.config;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Fotolio's own subscription with the photographer.
 *
 * <p>Not to be confused with {@code app.stripe} / {@code PaymentProperties},
 * which configures the Connect flow where a photographer's *client* pays them
 * and we take a commission. This one is the €19/€39/€79 the photographer pays
 * us.
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

    public int getTrialDays() {
        return trialDays;
    }

    public void setTrialDays(int trialDays) {
        this.trialDays = trialDays;
    }

    @PostConstruct
    public void validate() {
        if (trialDays < 1) {
            throw new IllegalStateException(
                "app.billing.trial-days must be at least 1 — a zero-day trial would put every new "
                    + "signup into the read-only lock before they saw a single screen.");
        }
    }
}
