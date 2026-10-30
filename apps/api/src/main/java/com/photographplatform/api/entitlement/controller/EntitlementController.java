package com.photographplatform.api.entitlement.controller;

import com.photographplatform.api.entitlement.dto.EntitlementsResponse;
import com.photographplatform.api.entitlement.service.EntitlementService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/entitlements")
public class EntitlementController {

    private final EntitlementService entitlementService;

    public EntitlementController(EntitlementService entitlementService) {
        this.entitlementService = entitlementService;
    }

    /**
     * The current tenant's plan, capabilities and write state.
     *
     * <p>Read by the dashboard shell on load to decide which navigation entries
     * are offered and whether to show the trial-ended banner. Authenticated but
     * deliberately not gated on anything else — a read-only tenant must still
     * be able to fetch the reason they are read-only.
     */
    @GetMapping
    public ResponseEntity<EntitlementsResponse> current() {
        return ResponseEntity.ok(EntitlementsResponse.from(entitlementService.accessForCurrentTenant()));
    }
}
