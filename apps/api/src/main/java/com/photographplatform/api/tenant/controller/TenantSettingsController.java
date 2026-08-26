package com.photographplatform.api.tenant.controller;

import com.photographplatform.api.auth.service.OwnershipGuard;
import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.payment.dto.StripeConnectStatusResponse;
import com.photographplatform.api.payment.dto.StripeOnboardingLinkResponse;
import com.photographplatform.api.payment.service.StripeConnectService;
import com.photographplatform.api.tenant.dto.BillingProfileRequest;
import com.photographplatform.api.tenant.dto.BillingProfileResponse;
import com.photographplatform.api.tenant.service.TenantSettingsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Tenant-level settings — the photographer's business identity and their
 * Stripe payout connection. Restricted to PHOTOGRAPHER/ADMIN in {@code
 * SecurityConfig}: a CUSTOMER holds a JWT scoped to the same tenant, and
 * these endpoints expose (and mutate) the tenant's tax numbers.
 */
@RestController
@RequestMapping("/api/settings")
public class TenantSettingsController {

    private final TenantSettingsService settingsService;
    private final StripeConnectService connectService;
    private final OwnershipGuard ownershipGuard;

    public TenantSettingsController(
        TenantSettingsService settingsService,
        StripeConnectService connectService,
        OwnershipGuard ownershipGuard
    ) {
        this.settingsService = settingsService;
        this.connectService = connectService;
        this.ownershipGuard = ownershipGuard;
    }

    @GetMapping("/billing-profile")
    public ResponseEntity<BillingProfileResponse> getBillingProfile() {
        return ResponseEntity.ok(settingsService.getBillingProfile());
    }

    /**
     * Owner only. This is the issuer identity printed on every §14 UStG
     * invoice the studio sends — changing it changes who, legally, billed the
     * client.
     */
    @PutMapping("/billing-profile")
    public ResponseEntity<BillingProfileResponse> updateBillingProfile(
        @Valid @RequestBody BillingProfileRequest request,
        HttpServletRequest http
    ) {
        ownershipGuard.requireOwner();
        return ResponseEntity.ok(settingsService.updateBillingProfile(request, ClientIp.from(http)));
    }

    @GetMapping("/stripe")
    public ResponseEntity<StripeConnectStatusResponse> stripeStatus() {
        return ResponseEntity.ok(connectService.getStatus());
    }

    /**
     * Owner only, and the sharpest reason {@link OwnershipGuard} exists.
     *
     * <p>Onboarding attaches the bank account that every client payment is
     * paid out to. Left open to members, a colleague could point the studio's
     * entire revenue at themselves — the one thing seats must not make
     * possible.
     */
    @PostMapping("/stripe/onboarding-link")
    public ResponseEntity<StripeOnboardingLinkResponse> stripeOnboardingLink(HttpServletRequest http) {
        ownershipGuard.requireOwner();
        return ResponseEntity.ok(connectService.createOnboardingLink(ClientIp.from(http)));
    }

    /**
     * Re-reads the connected account from Stripe. The settings page calls this
     * when the browser comes back from hosted onboarding, so the screen tells
     * the truth even if the {@code account.updated} webhook hasn't landed yet.
     */
    @PostMapping("/stripe/refresh")
    public ResponseEntity<StripeConnectStatusResponse> refreshStripe(HttpServletRequest http) {
        return ResponseEntity.ok(connectService.refreshStatus(ClientIp.from(http)));
    }
}
