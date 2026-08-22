package com.photographplatform.api.billing.controller;

import com.photographplatform.api.billing.service.BillingWebhookService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * Subscription lifecycle from Stripe. Public — Stripe calls it with no
 * session or JWT; the signature check inside
 * {@link BillingWebhookService#handle} is this endpoint's authentication.
 *
 * <p>Its own URL, separate from the Connect webhook at
 * {@code /api/public/webhooks/stripe}. Two endpoints in Stripe means two
 * signing secrets and two independently visible delivery histories — rotating
 * or breaking one cannot silently take the other down, and "are subscriptions
 * arriving?" is answerable without reading through charge traffic.
 */
@RestController
public class BillingWebhookController {

    private final BillingWebhookService webhookService;

    public BillingWebhookController(BillingWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping("/api/public/webhooks/stripe/billing")
    public ResponseEntity<Void> handle(
        @RequestBody String payload,
        @RequestHeader("Stripe-Signature") String signature
    ) {
        webhookService.handle(payload, signature);
        return ResponseEntity.ok().build();
    }
}
