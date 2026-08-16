package com.photographplatform.api.lead.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.service.BookingService;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.domain.LeadStatus;
import com.photographplatform.api.lead.dto.ConvertLeadRequest;
import com.photographplatform.api.lead.repository.LeadRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The lead → booking funnel step.
 *
 * <p>Split out of {@link LeadService} because it is the only lead operation
 * that reaches into the booking module: it changes whenever booking creation
 * changes (new pricing fields, a new required booking attribute), which has
 * nothing to do with why lead intake or lead editing changes. Keeping it in
 * {@code LeadService} was also what forced that class to depend on
 * {@code BookingService}, coupling every lead endpoint to the booking module's
 * startup graph.
 */
@Service
public class LeadConversionService {

    private final LeadRepository leadRepository;
    private final BookingService bookingService;
    private final AuditService auditService;

    public LeadConversionService(LeadRepository leadRepository,
                                 BookingService bookingService,
                                 AuditService auditService) {
        this.leadRepository = leadRepository;
        this.bookingService = bookingService;
        this.auditService = auditService;
    }

    /**
     * Convert a lead into a booking. The booking inherits the lead's contact
     * info, event date and type; the photographer supplies the remaining
     * operational fields (time, location, pricing) via {@link ConvertLeadRequest}.
     *
     * <p>Idempotent on the lead side: a second convert call against a lead that
     * is already {@code BOOKED} returns HTTP 409 rather than silently producing
     * a duplicate booking. Booking creation and the lead status flip happen in
     * the same transaction so a failure midway never leaves the lead
     * advertising "BOOKED" without a matching booking row.
     */
    @Transactional
    public BookingResponse convertLead(UUID leadId, ConvertLeadRequest overrides, String ipAddress) {
        Lead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new NotFoundException("Lead not found: " + leadId));

        LeadStatus previousStatus = lead.getStatus();
        if (previousStatus == LeadStatus.BOOKED) {
            throw new ConflictException("Lead already converted: " + leadId);
        }
        previousStatus.assertCanTransitionTo(LeadStatus.BOOKED);

        BookingResponse booking = bookingService.createFromLead(lead, overrides, ipAddress);

        lead.setStatus(LeadStatus.BOOKED);
        leadRepository.save(lead);

        auditService.log(
            "LEAD_CONVERTED",
            "LEAD",
            lead.getId(),
            SecurityUtils.currentTenantId(),
            SecurityUtils.requireCurrentUserId(),
            ipAddress,
            previousStatus.name(),
            LeadStatus.BOOKED.name()
        );

        return booking;
    }
}
