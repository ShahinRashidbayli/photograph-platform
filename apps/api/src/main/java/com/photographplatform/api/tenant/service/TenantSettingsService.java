package com.photographplatform.api.tenant.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.dto.BillingProfileRequest;
import com.photographplatform.api.tenant.dto.BillingProfileResponse;
import com.photographplatform.api.tenant.dto.EnquiryAcknowledgementSetting;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tenant-level settings the photographer owns: the billing profile printed on
 * every invoice, and whether enquiries are acknowledged automatically.
 *
 * <p>Until this existed the columns V12 added were unreachable — {@code
 * setTaxId}/{@code setVatId} had no callers, which is why {@link
 * Tenant#hasBillingProfile()} had the §14 Abs. 4 Nr. 2 tax-number requirement
 * commented out and why no tenant could legally issue an invoice at all.
 */
@Service
public class TenantSettingsService {

    private final TenantRepository tenantRepository;
    private final AuditService auditService;

    public TenantSettingsService(TenantRepository tenantRepository, AuditService auditService) {
        this.tenantRepository = tenantRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public BillingProfileResponse getBillingProfile() {
        return toResponse(tenantRepository.require(SecurityUtils.requireCurrentTenantId()));
    }

    @Transactional
    public BillingProfileResponse updateBillingProfile(BillingProfileRequest req, String ipAddress) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();
        Tenant tenant = tenantRepository.require(tenantId);

        String taxId = Normalize.trimToNull(req.taxId());
        String vatId = Normalize.trimToNull(req.vatId());
        // §14 Abs. 4 Nr. 2 UStG: an invoice must carry the issuer's
        // Steuernummer *or* their USt-IdNr. Neither field alone is mandatory,
        // so this can't be a @NotBlank — but saving a profile with both empty
        // would leave invoicing silently blocked with nothing on screen to say
        // which field was missing.
        if (taxId == null && vatId == null) {
            throw new IllegalArgumentException(
                "Enter your Steuernummer or your USt-IdNr. — German invoices must carry one of them (§14 UStG)");
        }

        tenant.setBusinessName(req.businessName().trim());
        tenant.setAddressLine1(req.addressLine1().trim());
        tenant.setAddressLine2(Normalize.trimToNull(req.addressLine2()));
        tenant.setPostalCode(req.postalCode().trim());
        tenant.setCity(req.city().trim());
        tenant.setCountry(Normalize.upper(req.country().trim()));
        tenant.setTaxId(taxId);
        tenant.setVatId(vatId);
        tenant.setTaxMode(req.taxMode());
        tenantRepository.save(tenant);

        // Deliberately no old/new values: the tax numbers are the tenant's own
        // identifiers, and an audit trail of them adds nothing that the row
        // itself doesn't already hold.
        auditService.log("TENANT_BILLING_PROFILE_UPDATED", "TENANT", tenantId, tenantId, actorId, ipAddress);

        return toResponse(tenant);
    }

    @Transactional(readOnly = true)
    public EnquiryAcknowledgementSetting getEnquiryAcknowledgement() {
        return new EnquiryAcknowledgementSetting(
            tenantRepository.require(SecurityUtils.requireCurrentTenantId()).isEnquiryAcknowledgementEnabled());
    }

    /**
     * Switches the automatic "Enquiry received" acknowledgement on or off. It
     * speaks to the studio's Customers in the studio's name, so who turned it
     * off, and when, is worth keeping.
     */
    @Transactional
    public EnquiryAcknowledgementSetting updateEnquiryAcknowledgement(EnquiryAcknowledgementSetting req,
                                                                      String ipAddress) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();
        Tenant tenant = tenantRepository.require(tenantId);

        boolean before = tenant.isEnquiryAcknowledgementEnabled();
        boolean after = req.enabled();
        if (before != after) {
            tenant.setEnquiryAcknowledgementEnabled(after);
            tenantRepository.save(tenant);
            auditService.logChange("TENANT_ENQUIRY_ACKNOWLEDGEMENT_UPDATED", "TENANT", tenantId, tenantId,
                actorId, ipAddress, String.valueOf(before), String.valueOf(after));
        }
        return new EnquiryAcknowledgementSetting(after);
    }

    private BillingProfileResponse toResponse(Tenant tenant) {
        return new BillingProfileResponse(
            tenant.getBusinessName(),
            tenant.getAddressLine1(),
            tenant.getAddressLine2(),
            tenant.getPostalCode(),
            tenant.getCity(),
            tenant.getCountry(),
            tenant.getTaxId(),
            tenant.getVatId(),
            tenant.getTaxMode().name(),
            tenant.hasBillingProfile()
        );
    }
}
