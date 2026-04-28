package com.photographplatform.api.portfolio.controller;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.portfolio.dto.PhotoResponse;
import com.photographplatform.api.portfolio.service.PhotoService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PortfolioController {

    private final PhotoService photoService;
    private final TenantRepository tenantRepository;

    public PortfolioController(PhotoService photoService, TenantRepository tenantRepository) {
        this.photoService = photoService;
        this.tenantRepository = tenantRepository;
    }

    @GetMapping("/public/portfolio/{subdomain}")
    public ResponseEntity<List<PhotoResponse>> getPublicPortfolio(@PathVariable String subdomain) {
        Tenant tenant = tenantRepository.findBySubdomain(subdomain)
            .orElseThrow(() -> new NotFoundException("Photographer not found: " + subdomain));

        TenantContext.setTenant(tenant.getId().toString());
        try {
            List<PhotoResponse> photos = photoService.listPublished();
            return ResponseEntity.ok(photos);
        } finally {
            TenantContext.clear();
        }
    }

    @GetMapping("/portfolio/photos")
    public ResponseEntity<List<PhotoResponse>> listAll() {
        List<PhotoResponse> photos = photoService.listAll();
        return ResponseEntity.ok(photos);
    }

    @PostMapping("/portfolio/photos/{id}/publish")
    public ResponseEntity<PhotoResponse> publishPhoto(@PathVariable UUID id) {
        PhotoResponse photo = photoService.publish(id);
        return ResponseEntity.ok(photo);
    }

    @DeleteMapping("/portfolio/photos/{id}")
    public ResponseEntity<Void> deletePhoto(@PathVariable UUID id) {
        photoService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
