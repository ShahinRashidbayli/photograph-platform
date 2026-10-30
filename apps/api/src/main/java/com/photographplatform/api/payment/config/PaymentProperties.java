package com.photographplatform.api.payment.config;

import jakarta.annotation.PostConstruct;
import java.util.Locale;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.stripe")
public class PaymentProperties {

    private String secretKey;

    /**
     * pk_… — handed to the browser alongside a PaymentIntent's client secret
     * so Stripe.js can mount the payment element. Public by design (it is
     * printed in every Stripe integration's page source); it is here rather
     * than in the frontend's env because the connected account id it must be
     * paired with is only known server-side, per invoice.
     */
    private String publishableKey;

    private String webhookSecret;

    private Commission commission = new Commission();

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getPublishableKey() {
        return publishableKey;
    }

    public void setPublishableKey(String publishableKey) {
        this.publishableKey = publishableKey;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = webhookSecret;
    }

    public Commission getCommission() {
        return commission;
    }

    public void setCommission(Commission commission) {
        this.commission = commission;
    }

    /**
     * Refuses to start with Stripe half-configured.
     *
     * <p>Same reasoning as {@code EmailProperties}: the failure mode is silent
     * and only visible to the customer. {@code StripeConfig} builds its client
     * from the secret key alone, so a deployment with a secret key but no
     * publishable key reports "Ready" on the photographer's settings screen and
     * accepts every Pay click — creating a real PaymentIntent on the connected
     * account and then abandoning it, because the browser has no key to confirm
     * it with. Likewise a missing webhook secret makes every payment settle
     * nowhere: {@code handleWebhookEvent} rejects the delivery, so money is
     * taken and no invoice is ever marked paid.
     *
     * <p>Running with no Stripe at all stays perfectly legal — Überweisung
     * needs none of this. It just has to be said by leaving the secret key
     * blank, not by forgetting one of its companions.
     */
    @PostConstruct
    public void validate() {
        if (secretKey == null || secretKey.isBlank()) {
            return;
        }
        // A publishable key in the secret slot would 401 on the first call; the
        // reverse is far worse — a secret key handed to every browser with a
        // client secret. Neither is a typo worth discovering in production.
        if (secretKey.startsWith("pk_")) {
            throw new IllegalStateException(
                "STRIPE_SECRET_KEY looks like a publishable key (pk_…). Use the secret key (sk_… or rk_…).");
        }
        if (publishableKey == null || publishableKey.isBlank()) {
            throw new IllegalStateException(
                "STRIPE_SECRET_KEY is set but STRIPE_PUBLISHABLE_KEY is not. The browser needs it to "
                    + "confirm a payment, so every card/SEPA attempt would create a live PaymentIntent "
                    + "and then abandon it. Set it, or leave STRIPE_SECRET_KEY blank to run on bank "
                    + "transfer only.");
        }
        if (!publishableKey.startsWith("pk_")) {
            throw new IllegalStateException(
                "STRIPE_PUBLISHABLE_KEY must start with 'pk_' — it is sent to the browser, so a secret "
                    + "key here would be handed to every visitor.");
        }
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new IllegalStateException(
                "STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is not. Without it every webhook "
                    + "delivery is rejected, so payments are collected and no invoice is ever marked "
                    + "paid. Set it, or leave STRIPE_SECRET_KEY blank to run on bank transfer only.");
        }
    }

    /**
     * The platform's cut of a collected payment, per plan, in basis points.
     *
     * <p>PRICING.md §4/§7.1, decided 2026-07-17: Starter pays 2% on what it
     * collects instead of being locked out of payments entirely, and "0%
     * commission" is exactly what Pro sells. Expressed in basis points rather
     * than a percentage so the arithmetic stays in integers all the way to
     * {@code application_fee_amount}, which Stripe takes in cents.
     */
    public static class Commission {

        private int starterBps = 200;
        private int proBps;
        private int studioBps;

        public int getStarterBps() {
            return starterBps;
        }

        public void setStarterBps(int starterBps) {
            this.starterBps = starterBps;
        }

        public int getProBps() {
            return proBps;
        }

        public void setProBps(int proBps) {
            this.proBps = proBps;
        }

        public int getStudioBps() {
            return studioBps;
        }

        public void setStudioBps(int studioBps) {
            this.studioBps = studioBps;
        }

        /** Unknown/blank plans fall back to the Starter rate — never to free. */
        public int bpsForPlan(String plan) {
            String normalized = plan == null ? "" : plan.trim().toUpperCase(Locale.ROOT);
            return switch (normalized) {
                case "PRO" -> proBps;
                case "STUDIO" -> studioBps;
                default -> starterBps;
            };
        }

        /**
         * The fee on {@code amountCents} for {@code plan}, rounded half-up to
         * whole cents and never allowed to reach the charge total (Stripe
         * rejects an application fee ≥ the amount, and a 100% fee would mean
         * the photographer collected nothing).
         */
        public long feeCents(long amountCents, String plan) {
            int bps = bpsForPlan(plan);
            if (bps <= 0 || amountCents <= 0) {
                return 0L;
            }
            long fee = Math.round(amountCents * (bps / 10_000d));
            return Math.min(fee, Math.max(0L, amountCents - 1));
        }
    }
}
