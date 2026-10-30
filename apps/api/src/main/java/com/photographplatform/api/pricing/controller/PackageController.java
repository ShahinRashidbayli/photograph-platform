package com.photographplatform.api.pricing.controller;

import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.pricing.dto.PackageRequest;
import com.photographplatform.api.pricing.dto.PackageResponse;
import com.photographplatform.api.pricing.service.PackageService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Package CRUD for the photographer admin. Role-gated to PHOTOGRAPHER/ADMIN in
 * {@code SecurityConfig} — a CUSTOMER token must never reach this surface, both
 * because pricing is internal and because mutations here change what every
 * future booking sees.
 */
@RestController
@RequestMapping("/api/packages")
public class PackageController {

    private final PackageService packageService;

    public PackageController(PackageService packageService) {
        this.packageService = packageService;
    }

    @GetMapping
    public ResponseEntity<List<PackageResponse>> list(
        @RequestParam(name = "activeOnly", defaultValue = "false") boolean activeOnly
    ) {
        return ResponseEntity.ok(packageService.listAll(activeOnly));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PackageResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(packageService.get(id));
    }

    @PostMapping
    public ResponseEntity<PackageResponse> create(
        @Valid @RequestBody PackageRequest request,
        HttpServletRequest httpRequest
    ) {
        PackageResponse created = packageService.create(request, ClientIp.from(httpRequest));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<PackageResponse> update(
        @PathVariable UUID id,
        @Valid @RequestBody PackageRequest request,
        HttpServletRequest httpRequest
    ) {
        return ResponseEntity.ok(packageService.update(id, request, ClientIp.from(httpRequest)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, HttpServletRequest httpRequest) {
        packageService.delete(id, ClientIp.from(httpRequest));
        return ResponseEntity.noContent().build();
    }
}
