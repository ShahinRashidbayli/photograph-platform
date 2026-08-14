package com.photographplatform.api.pricing.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.pricing.domain.Package;
import com.photographplatform.api.pricing.dto.PackageRequest;
import com.photographplatform.api.pricing.dto.PackageResponse;
import com.photographplatform.api.pricing.repository.PackageRepository;
import java.util.List;
import java.util.UUID;
import com.photographplatform.api.common.security.SecurityUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PackageService {

    private final PackageRepository packageRepository;
    private final AuditService auditService;

    public PackageService(PackageRepository packageRepository, AuditService auditService) {
        this.packageRepository = packageRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<PackageResponse> listAll(boolean activeOnly) {
        List<Package> packages = activeOnly
            ? packageRepository.findByActiveTrueOrderBySortOrderAscNameAsc()
            : packageRepository.findAllByOrderBySortOrderAscNameAsc();
        return packages.stream().map(PackageService::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PackageResponse get(UUID id) {
        return toResponse(loadOrThrow(id));
    }

    @Transactional
    public PackageResponse create(PackageRequest request, String ipAddress) {
        Package pkg = new Package(request.name().trim(), request.priceCents());
        pkg.setTenantId(SecurityUtils.requireCurrentTenantId());
        applyOptionalFields(pkg, request);
        Package saved = packageRepository.save(pkg);

        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        // Pricing changes drive every future invoice — without this audit row
        // there's no way to answer "why was this booking €1,800?" months later.
        auditService.log(
            "PACKAGE_CREATED",
            "PACKAGE",
            saved.getId(),
            tenantId,
            actorId,
            ipAddress,
            null,
            String.valueOf(saved.getPriceCents())
        );

        return toResponse(saved);
    }

    /**
     * Full-replace update. PATCH semantics (only-overwrite-non-null) would be
     * possible too, but in a small admin UI a "save" button always sends the
     * whole edited row, so PUT-style is simpler and avoids the trap of
     * accidentally not being able to clear an optional field.
     */
    @Transactional
    public PackageResponse update(UUID id, PackageRequest request, String ipAddress) {
        Package pkg = loadOrThrow(id);
        Integer oldPriceCents = pkg.getPriceCents();
        pkg.setName(request.name().trim());
        pkg.setPriceCents(request.priceCents());
        applyOptionalFields(pkg, request);

        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        // Record the price delta in old/new so a future audit reader can
        // reconstruct the pricing timeline without joining other tables.
        // Use the request id (not pkg.getId()) so the audit row is stable even
        // when the entity is reattached / lazy-loaded — they're the same value
        // since we just loaded by it.
        auditService.log(
            "PACKAGE_UPDATED",
            "PACKAGE",
            id,
            tenantId,
            actorId,
            ipAddress,
            String.valueOf(oldPriceCents),
            String.valueOf(pkg.getPriceCents())
        );

        return toResponse(pkg);
    }

    @Transactional
    public void delete(UUID id, String ipAddress) {
        // A package referenced by a booking should not vanish from the
        // booking's history. The DB FK is ON DELETE SET NULL, so deleting here
        // is safe (the booking keeps total_amount_cents, just loses the
        // package_id pointer). Soft-delete via is_active=false is the
        // photographer's normal "retire this package" path.
        // TODO: switch this endpoint to flip active=false instead of hard
        // delete; expose a separate admin-only purge for true removal.
        Package pkg = loadOrThrow(id);
        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        auditService.log(
            "PACKAGE_DELETED",
            "PACKAGE",
            id,
            tenantId,
            actorId,
            ipAddress,
            String.valueOf(pkg.getPriceCents()),
            null
        );
        packageRepository.delete(pkg);
    }

    private void applyOptionalFields(Package pkg, PackageRequest request) {
        if (request.currency() != null && !request.currency().isBlank()) {
            pkg.setCurrency(request.currency().trim().toUpperCase());
        }
        pkg.setDurationHours(request.durationHours());
        pkg.setIncludedPhotos(request.includedPhotos());
        if (request.active() != null) {
            pkg.setActive(request.active());
        }
        if (request.sortOrder() != null) {
            pkg.setSortOrder(request.sortOrder());
        }
    }

    private Package loadOrThrow(UUID id) {
        return packageRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Package not found: " + id));
    }

    private static PackageResponse toResponse(Package pkg) {
        return new PackageResponse(
            pkg.getId(),
            pkg.getName(),
            pkg.getPriceCents(),
            pkg.getCurrency(),
            pkg.getDurationHours(),
            pkg.getIncludedPhotos(),
            pkg.isActive(),
            pkg.getSortOrder()
        );
    }
}
