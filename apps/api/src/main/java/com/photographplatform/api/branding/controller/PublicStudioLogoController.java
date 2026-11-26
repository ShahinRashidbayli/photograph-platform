package com.photographplatform.api.branding.controller;

import com.photographplatform.api.branding.service.BrandingService;
import java.net.URI;
import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The stable address of a studio's logo, for Customer messages.
 *
 * <p>Public under {@code /api/public/**}: the reader is a mail client with no
 * session.
 */
@RestController
@RequestMapping("/api")
public class PublicStudioLogoController {

    /**
     * Well inside the 60-minute signature: a cache that held the redirect any
     * longer would hand out a target that already answers 403.
     */
    private static final CacheControl REDIRECT_CACHE = CacheControl.maxAge(5, TimeUnit.MINUTES);

    private final BrandingService brandingService;

    public PublicStudioLogoController(BrandingService brandingService) {
        this.brandingService = brandingService;
    }

    @GetMapping("/public/studios/{subdomain}/logo")
    public ResponseEntity<Void> logo(@PathVariable String subdomain) {
        return ResponseEntity.status(HttpStatus.FOUND)
            .location(URI.create(brandingService.logoUrlForSubdomain(subdomain)))
            .cacheControl(REDIRECT_CACHE)
            .build();
    }
}
