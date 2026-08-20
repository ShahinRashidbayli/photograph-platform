package com.photographplatform.api.payment.dto;

/**
 * A single-use link into Stripe's hosted Express onboarding. Short-lived by
 * design (Stripe expires it in minutes), so it is never stored — the settings
 * screen requests one at the moment the photographer clicks through.
 */
public record StripeOnboardingLinkResponse(String url) {
}
