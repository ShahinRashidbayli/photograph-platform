package com.photographplatform.api.payment.controller;

import com.photographplatform.api.payment.service.StripeWebhookService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public — Stripe calls this directly with no session/JWT. Under {@code
 * /api/public/**}, which {@code SecurityConfig} already {@code permitAll}s
 * and the CSRF filter already exempts by prefix; the {@link
 * com.stripe.net.Webhook#constructEvent} signature check inside {@link
 * StripeWebhookService#handle} is this endpoint's actual authentication.
 */
@RestController
public class StripeWebhookController {

    private final StripeWebhookService webhookService;

    public StripeWebhookController(StripeWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping("/api/public/webhooks/stripe")
    public ResponseEntity<Void> handle(
        @RequestBody String payload,
        @RequestHeader("Stripe-Signature") String signature
    ) {
        webhookService.handle(payload, signature);
        return ResponseEntity.ok().build();
    }
}
