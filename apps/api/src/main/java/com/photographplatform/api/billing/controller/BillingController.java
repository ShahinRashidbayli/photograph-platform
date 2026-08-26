package com.photographplatform.api.billing.controller;

import com.photographplatform.api.billing.dto.BillingStatusResponse;
import com.photographplatform.api.billing.dto.CheckoutSessionResponse;
import com.photographplatform.api.billing.dto.StartCheckoutRequest;
import com.photographplatform.api.auth.service.OwnershipGuard;
import com.photographplatform.api.billing.service.BillingService;
import com.photographplatform.api.common.security.AllowedWhenReadOnly;
import com.photographplatform.api.common.security.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Subscribing, and managing the subscription afterwards.
 *
 * <p>{@link AllowedWhenReadOnly} on the whole controller is load-bearing, not
 * a convenience. The read-only lock blocks every mutating request from a
 * lapsed account — and subscribing is a POST. Without this exemption the
 * account can never be unlocked: the photographer cannot pay, so they stay
 * locked, so they cannot pay. A billing endpoint that is itself gated on
 * billing is a deadlock with a customer inside it.
 */
@RestController
@RequestMapping("/api/billing")
@AllowedWhenReadOnly
public class BillingController {

    private final BillingService billingService;
    private final OwnershipGuard ownershipGuard;

    public BillingController(BillingService billingService, OwnershipGuard ownershipGuard) {
        this.billingService = billingService;
        this.ownershipGuard = ownershipGuard;
    }

    @GetMapping
    public ResponseEntity<BillingStatusResponse> status() {
        return ResponseEntity.ok(billingService.getStatus());
    }

    /**
     * Opens a Stripe Checkout session. Does not change the plan by itself.
     *
     * <p>Owner only. Reading the plan is something every colleague may do —
     * the screen shows it — but committing the studio to a subscription is
     * spending its money.
     */
    @PostMapping("/checkout")
    public ResponseEntity<CheckoutSessionResponse> checkout(
        @Valid @RequestBody StartCheckoutRequest request, HttpServletRequest http) {
        ownershipGuard.requireOwner();
        return ResponseEntity.ok(billingService.startCheckout(request, ClientIp.from(http)));
    }

    /**
     * Opens Stripe's hosted portal for card changes, invoices and cancellation.
     *
     * <p>Owner only, and this one matters more than checkout: the portal can
     * cancel the subscription and exposes the card on file.
     */
    @PostMapping("/portal")
    public ResponseEntity<CheckoutSessionResponse> portal() {
        ownershipGuard.requireOwner();
        return ResponseEntity.ok(billingService.openPortal());
    }
}
