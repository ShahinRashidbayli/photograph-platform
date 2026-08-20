package com.photographplatform.api.tenant.controller;

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

    public TenantSettingsController(
        TenantSettingsService settingsService,
        StripeConnectService connectService
    ) {
        this.settingsService = settingsService;
        this.connectService = connectService;
    }

    @GetMapping("/billing-profile")
    public ResponseEntity<BillingProfileResponse> getBillingProfile() {
        return ResponseEntity.ok(settingsService.getBillingProfile());
    }

    @PutMapping("/billing-profile")
    public ResponseEntity<BillingProfileResponse> updateBillingProfile(
        @Valid @RequestBody BillingProfileRequest request,
        HttpServletRequest http
    ) {
        return ResponseEntity.ok(settingsService.updateBillingProfile(request, ClientIp.from(http)));
    }

    @GetMapping("/stripe")
    public ResponseEntity<StripeConnectStatusResponse> stripeStatus() {
        return ResponseEntity.ok(connectService.getStatus());
    }

    @PostMapping("/stripe/onboarding-link")
    public ResponseEntity<StripeOnboardingLinkResponse> stripeOnboardingLink(HttpServletRequest http) {
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
