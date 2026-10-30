package com.photographplatform.api.tenant.controller;

import com.photographplatform.api.auth.dto.AvatarPresignResponse;
import com.photographplatform.api.auth.service.AvatarService;
import com.photographplatform.api.auth.service.OwnershipGuard;
import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.branding.dto.BrandingResponse;
import com.photographplatform.api.branding.dto.UpdateBrandingRequest;
import com.photographplatform.api.branding.service.BrandingService;
import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.common.security.SecurityUtils;
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
import org.springframework.web.bind.annotation.RequestParam;
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
    private final BrandingService brandingService;
    private final AvatarService avatarService;
    private final EntitlementService entitlementService;

    public TenantSettingsController(
        TenantSettingsService settingsService,
        StripeConnectService connectService,
        OwnershipGuard ownershipGuard,
        BrandingService brandingService,
        AvatarService avatarService,
        EntitlementService entitlementService
    ) {
        this.settingsService = settingsService;
        this.connectService = connectService;
        this.ownershipGuard = ownershipGuard;
        this.brandingService = brandingService;
        this.avatarService = avatarService;
        this.entitlementService = entitlementService;
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

    /**
     * Pre-signs a direct-to-R2 upload for the studio's logo.
     *
     * <p>Reuses the avatar path's service — same whitelist, same size cap, same
     * signed Content-Length — with a different key prefix. Owner-gated and
     * plan-gated, so a Starter tenant cannot fill the bucket with objects it
     * will never be allowed to display.
     */
    @PostMapping("/branding/logo/presign")
    public ResponseEntity<AvatarPresignResponse> presignLogo(
        @RequestParam String contentType,
        @RequestParam long fileSizeBytes
    ) {
        ownershipGuard.requireOwner();
        entitlementService.requireCapabilityForCurrentTenant(Capability.WHITE_LABEL_BRANDING);
        return ResponseEntity.ok(avatarService.presign(contentType, fileSizeBytes, "logos"));
    }

    /** The studio's logo and colour, for the settings form. */
    @GetMapping("/branding")
    public ResponseEntity<BrandingResponse> getBranding() {
        return ResponseEntity.ok(
            brandingService.forTenant(SecurityUtils.requireCurrentTenantId()));
    }

    /**
     * Owner only, and plan-gated in the service. Branding is what a studio's
     * clients see, so changing it is closer to changing the invoice issuer than
     * to changing a personal preference.
     */
    @PutMapping("/branding")
    public ResponseEntity<BrandingResponse> updateBranding(
        @Valid @RequestBody UpdateBrandingRequest request) {
        ownershipGuard.requireOwner();
        return ResponseEntity.ok(
            brandingService.update(SecurityUtils.requireCurrentTenantId(), request));
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
