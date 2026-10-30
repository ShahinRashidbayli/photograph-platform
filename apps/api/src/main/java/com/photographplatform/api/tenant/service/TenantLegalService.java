package com.photographplatform.api.tenant.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.dto.TenantLegalResponse;
import com.photographplatform.api.tenant.dto.UpdateTenantLegalRequest;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads and writes a photographer's statutory disclosure details.
 *
 * <p><b>Why this exists.</b> The platform ships its own Impressum, Datenschutz
 * and AGB pages for {@code fotolio.de}, but those cover Fotolio as the service
 * operator. A photographer's public portfolio and request form are their own
 * commercial presence: §5 DDG makes them individually liable for an Impressum
 * there, and under GDPR they — not Fotolio — are the controller for the client
 * data their form collects. Serving the platform's pages on a photographer's
 * subdomain would leave every photographer exposed to an Abmahnung.
 *
 * <p><b>Completeness is advisory, not enforced on write.</b> Refusing to save a
 * partially-filled form would leave the photographer with nothing stored at all;
 * flagging the gap lets them finish later while the public page stays honest
 * about not being published yet.
 */
@Service
public class TenantLegalService {

    private final TenantRepository tenantRepository;
    private final AuditService auditService;

    public TenantLegalService(TenantRepository tenantRepository, AuditService auditService) {
        this.tenantRepository = tenantRepository;
        this.auditService = auditService;
    }

    /**
     * Public read for a photographer's own Impressum / Datenschutz pages.
     *
     * <p>Withholds the details until they are complete. The public pages already
     * refuse to render a partial Impressum, so an incomplete tenant has nothing
     * a visitor is entitled to see — and serving the half-filled draft anyway
     * would leave a private address readable by anyone iterating subdomains,
     * for no one's benefit. Settings reads through {@link #getOwn} instead and
     * still sees everything.
     */
    @Transactional(readOnly = true)
    public TenantLegalResponse forTenant(Tenant tenant) {
        return isComplete(tenant)
            ? toResponse(tenant)
            : TenantLegalResponse.unpublished(tenant.getSubdomain());
    }

    /** The signed-in photographer reading their own details back into Settings. */
    @Transactional(readOnly = true)
    public TenantLegalResponse getOwn() {
        return toResponse(requireOwnTenant());
    }

    @Transactional
    public TenantLegalResponse updateOwn(UpdateTenantLegalRequest req, String ipAddress) {
        Tenant tenant = requireOwnTenant();

        tenant.setLegalName(trimToNull(req.legalName()));
        tenant.setLegalStreet(trimToNull(req.legalStreet()));
        tenant.setLegalPostalCode(trimToNull(req.legalPostalCode()));
        tenant.setLegalCity(trimToNull(req.legalCity()));
        // Country has a sensible default; blanking it would render an address
        // that reads as incomplete on the public page for no good reason.
        String country = trimToNull(req.legalCountry());
        tenant.setLegalCountry(country == null ? "Deutschland" : country);
        tenant.setLegalEmail(trimToNull(req.legalEmail()));
        tenant.setLegalPhone(trimToNull(req.legalPhone()));
        tenant.setLegalVatId(trimToNull(req.legalVatId()));
        tenant.setLegalRegister(trimToNull(req.legalRegister()));
        tenant.setLegalResponsible(trimToNull(req.legalResponsible()));
        tenant.setPrivacyContactEmail(trimToNull(req.privacyContactEmail()));

        Tenant saved = tenantRepository.save(tenant);

        // Worth an audit row: these details are what a regulator or a claimant
        // would ask about, so "who changed the Impressum, and when" matters.
        auditService.log("TENANT_LEGAL_UPDATED", "TENANT", saved.getId(),
            saved.getId(), SecurityUtils.requireCurrentUserId(), ipAddress);

        return toResponse(saved);
    }

    /**
     * The mandatory §5 DDG set: who the provider is, where they can be reached
     * by post, and two independent ways to contact them directly. VAT id and
     * register entry are conditional on the business form, so they are not
     * required — a sole trader below the §19 UStG threshold has neither.
     */
    public static boolean isComplete(Tenant t) {
        return present(t.getLegalName())
            && present(t.getLegalStreet())
            && present(t.getLegalPostalCode())
            && present(t.getLegalCity())
            && present(t.getLegalEmail())
            && present(t.getLegalPhone());
    }

    private Tenant requireOwnTenant() {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        return tenantRepository.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Tenant not found: " + tenantId));
    }

    private static TenantLegalResponse toResponse(Tenant t) {
        return new TenantLegalResponse(
            t.getSubdomain(),
            t.getLegalName(),
            t.getLegalStreet(),
            t.getLegalPostalCode(),
            t.getLegalCity(),
            t.getLegalCountry(),
            t.getLegalEmail(),
            t.getLegalPhone(),
            t.getLegalVatId(),
            t.getLegalRegister(),
            t.getLegalResponsible(),
            t.getPrivacyContactEmail(),
            isComplete(t)
        );
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
