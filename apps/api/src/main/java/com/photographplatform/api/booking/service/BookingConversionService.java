package com.photographplatform.api.booking.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingPricing;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.inquiry.domain.InquiryRequest;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.dto.ConvertLeadRequest;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The two funnel steps that end in a booking: a lead the photographer
 * converted, and an inquiry they accepted.
 *
 * <p>Separate from {@code BookingCommandService} because the inputs are already
 * settled. Both callers have resolved and authorized their own subject — {@code
 * LeadConversionService} looks the lead up through RLS, {@code
 * InquiryRequestService} resolves the customer from {@code inquiry.customerId}
 * rather than from anything a request said — so what is left here is the
 * mapping into a booking, not another round of id validation. Bookings the
 * photographer types in from scratch are the other service's problem, and they
 * do need that round.
 *
 * <p>Neither path sets an assignee or resources: {@link ConvertLeadRequest}
 * carries neither, and an inquiry has neither, because the forms behind them
 * ask only what their source could not answer. Both are set afterwards through
 * {@code BookingCommandService#updateBooking}, which is the screen the
 * photographer lands on next.
 */
@Service
@Transactional
public class BookingConversionService {

    private final BookingRepository bookingRepository;
    private final BookingPricingResolver pricingResolver;
    private final AuditService auditService;
    private final BookingMapper mapper;

    public BookingConversionService(
        BookingRepository bookingRepository,
        BookingPricingResolver pricingResolver,
        AuditService auditService,
        BookingMapper mapper
    ) {
        this.bookingRepository = bookingRepository;
        this.pricingResolver = pricingResolver;
        this.auditService = auditService;
        this.mapper = mapper;
    }

    /**
     * Create a booking from an existing lead. The contact and event basics come
     * from the lead, the photographer fills the operational fields (time,
     * location, pricing) via {@link ConvertLeadRequest}. Linked back through
     * {@code leadId} so the audit trail and reporting can join them.
     *
     * <p>Always created in {@code ENQUIRY}: lifecycle changes go through
     * {@code BookingCommandService#changeStatus}, which is the single place
     * that validates transitions.
     */
    public BookingResponse createFromLead(
        Lead lead, ConvertLeadRequest overrides, String ipAddress) {
        UUID tenantId = SecurityUtils.currentTenantId();

        Booking booking = new Booking(
            lead.getName().trim(),
            Normalize.email(lead.getEmail()),
            lead.getEventDate()
        );
        booking.setTenantId(tenantId);
        booking.setLeadId(lead.getId());
        booking.setEventType(Normalize.trimToNull(lead.getEventType()));
        booking.setEventTime(overrides.eventTime());
        booking.setLocation(Normalize.trimToNull(overrides.location()));
        booking.applyPricing(pricingResolver.resolve(
            overrides.packageId(), overrides.totalAmountCents(), overrides.depositAmountCents()));
        booking.setInternalNotes(Normalize.trimToNull(overrides.internalNotes()));

        return save(booking, tenantId, ipAddress);
    }

    /**
     * Create a booking from an accepted customer inquiry. Contact details come
     * from the customer's own account, the event basics from the inquiry; the
     * photographer prices it afterwards. Linked back via {@code inquiryId} so
     * the funnel joins end to end.
     *
     * <p>{@code customer} is the inquiry's customer, resolved by the caller
     * from {@code inquiry.customerId}. The actor on the audit row is whoever is
     * signed in — the photographer doing the triage — and those being two
     * different people is the point, not an oversight.
     */
    public BookingResponse createFromInquiry(
        InquiryRequest inquiry, User customer, String ipAddress) {
        UUID tenantId = SecurityUtils.currentTenantId();

        String name = (customer.getFullName() == null || customer.getFullName().isBlank())
            ? customer.getEmail()
            : customer.getFullName();
        Booking booking = new Booking(
            name.trim(),
            Normalize.email(customer.getEmail()),
            inquiry.getProposedDate()
        );
        booking.setTenantId(tenantId);
        booking.setInquiryId(inquiry.getId());
        booking.setEventType(Normalize.trimToNull(inquiry.getEventType()));
        booking.setLocation(Normalize.trimToNull(inquiry.getLocation()));
        // Nothing quoted yet — said explicitly, in the same vocabulary the
        // other create paths use, rather than left to the field initialisers.
        booking.applyPricing(BookingPricing.unpriced());

        return save(booking, tenantId, ipAddress);
    }

    /** Both paths end the same way; {@link BookingStatus#ENQUIRY} is where a booking starts. */
    private BookingResponse save(Booking booking, UUID tenantId, String ipAddress) {
        Booking saved = bookingRepository.save(booking);
        auditService.log("BOOKING_CREATED", "BOOKING", saved.getId(), tenantId,
            SecurityUtils.requireCurrentUserId(), ipAddress);
        return mapper.withLookups(saved);
    }
}
