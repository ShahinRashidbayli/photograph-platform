package com.photographplatform.api.booking.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.dto.CustomerBookingResponse;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.client.repository.ClientRepository;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.dto.ConvertLeadRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    public BookingService(
        BookingRepository bookingRepository,
        ClientRepository clientRepository,
        UserRepository userRepository,
        AuditService auditService
    ) {
        this.bookingRepository = bookingRepository;
        this.clientRepository = clientRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
    }

    /**
     * Create a booking on behalf of the authenticated photographer. The booking
     * is always created in {@code ENQUIRY}; advancing it goes through
     * {@link #changeStatus} so the lifecycle state machine is the single place
     * that validates transitions.
     */
    @Transactional
    public BookingResponse createBooking(CreateBookingRequest request, String ipAddress) {
        UUID actorId = currentUserId();
        UUID tenantId = userRepository.findById(actorId)
            .map(User::getTenantId)
            .orElse(null);

        // If the caller linked the booking to a directory client, make sure it
        // exists in *this* tenant (the per-request search_path scopes the
        // lookup) — fail with 404 rather than persisting a dangling reference.
        if (request.clientId() != null && !clientRepository.existsById(request.clientId())) {
            throw new NotFoundException("Client not found: " + request.clientId());
        }

        Booking booking = new Booking(
            request.clientName().trim(),
            request.clientEmail().trim().toLowerCase(),
            request.eventDate()
        );
        booking.setClientId(request.clientId());
        booking.setEventTime(request.eventTime());
        booking.setEventType(trimToNull(request.eventType()));
        booking.setLocation(trimToNull(request.location()));
        booking.setPackageId(request.packageId());
        booking.setTotalAmountCents(request.totalAmountCents() != null ? request.totalAmountCents() : 0);
        booking.setDepositAmountCents(request.depositAmountCents() != null ? request.depositAmountCents() : 0);
        booking.setInternalNotes(trimToNull(request.internalNotes()));
        booking.setStatus(BookingStatus.ENQUIRY.name());

        Booking saved = bookingRepository.save(booking);

        auditService.log(
            "BOOKING_CREATED",
            "BOOKING",
            saved.getId(),
            tenantId,
            actorId,
            ipAddress
        );

        return toResponse(saved);
    }

    /**
     * Create a booking from an existing lead. Used by the lead-conversion
     * endpoint: the contact + event basics come from the lead, the
     * photographer fills in the operational fields (time, location, pricing)
     * via {@link ConvertLeadRequest}. The booking is linked back to the lead
     * through {@code leadId} so the audit trail and reporting can join them.
     *
     * <p>Always created in {@code ENQUIRY} for the same reason as the manual
     * create path: lifecycle changes must go through {@link #changeStatus}.
     */
    @Transactional
    public BookingResponse createFromLead(Lead lead, ConvertLeadRequest overrides, String ipAddress) {
        UUID actorId = currentUserId();
        UUID tenantId = userRepository.findById(actorId)
            .map(User::getTenantId)
            .orElse(null);

        Booking booking = new Booking(
            lead.getName().trim(),
            lead.getEmail().trim().toLowerCase(),
            lead.getEventDate()
        );
        booking.setLeadId(lead.getId());
        booking.setEventType(trimToNull(lead.getEventType()));
        booking.setEventTime(overrides.eventTime());
        booking.setLocation(trimToNull(overrides.location()));
        booking.setPackageId(overrides.packageId());
        booking.setTotalAmountCents(overrides.totalAmountCents() != null ? overrides.totalAmountCents() : 0);
        booking.setDepositAmountCents(overrides.depositAmountCents() != null ? overrides.depositAmountCents() : 0);
        booking.setInternalNotes(trimToNull(overrides.internalNotes()));
        booking.setStatus(BookingStatus.ENQUIRY.name());

        Booking saved = bookingRepository.save(booking);

        auditService.log(
            "BOOKING_CREATED",
            "BOOKING",
            saved.getId(),
            tenantId,
            actorId,
            ipAddress
        );

        return toResponse(saved);
    }

    /**
     * List the bookings owned by the currently authenticated customer.
     *
     * <p>The caller's identity is resolved from the JWT (not a request
     * parameter) and matched against the booking's {@code client_email}: this
     * is what closes the IDOR where a customer could read another customer's
     * bookings by supplying an arbitrary {@code clientId}. The result is mapped
     * to {@link CustomerBookingResponse}, which excludes the photographer's
     * internal notes.
     */
    @Transactional(readOnly = true)
    public List<CustomerBookingResponse> getOwnBookings(String rawStatus, int page, int size) {
        User user = userRepository.findById(currentUserId())
            .orElseThrow(() -> new UnauthorizedException("Authentication required"));
        String email = user.getEmail();

        Pageable pageable = PageRequest.of(page, size, Sort.by("eventDate").ascending());
        Page<Booking> result = (rawStatus != null && !rawStatus.isBlank())
            ? bookingRepository.findByClientEmailIgnoreCaseAndStatus(email, rawStatus, pageable)
            : bookingRepository.findByClientEmailIgnoreCaseOrderByEventDateAsc(email, pageable);

        return result.stream().map(BookingService::toCustomerResponse).toList();
    }

    /**
     * Transition a booking to a new status, enforcing the legal lifecycle
     * defined in {@link BookingStatus}. Illegal transitions raise HTTP 409
     * (via {@code ConflictException}); unknown booking IDs raise HTTP 404.
     */
    @Transactional
    public BookingResponse changeStatus(UUID bookingId, String rawNewStatus, String ipAddress) {
        Booking booking = bookingRepository.findById(bookingId)
            .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));

        BookingStatus current = BookingStatus.parse(booking.getStatus());
        BookingStatus next = BookingStatus.parse(rawNewStatus);
        current.assertCanTransitionTo(next);

        booking.setStatus(next.name());
        Booking saved = bookingRepository.save(booking);

        UUID actorId = currentUserId();
        UUID tenantId = userRepository.findById(actorId)
            .map(User::getTenantId)
            .orElse(null);
        auditService.log(
            "BOOKING_STATUS_CHANGED",
            "BOOKING",
            saved.getId(),
            tenantId,
            actorId,
            ipAddress,
            current.name(),
            next.name()
        );

        return toResponse(saved);
    }

    private UUID currentUserId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) {
            throw new UnauthorizedException("Authentication required");
        }
        try {
            return UUID.fromString(auth.getPrincipal().toString());
        } catch (IllegalArgumentException ex) {
            throw new UnauthorizedException("Authentication required");
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private BookingResponse toResponse(Booking booking) {
        return new BookingResponse(
            booking.getId(),
            booking.getClientName(),
            booking.getClientEmail(),
            booking.getEventDate(),
            booking.getEventTime(),
            booking.getEventType(),
            booking.getLocation(),
            booking.getPackageId(),
            booking.getTotalAmountCents(),
            booking.getDepositAmountCents(),
            booking.getStatus(),
            booking.getInternalNotes(),
            booking.getCreatedAt()
        );
    }

    private static CustomerBookingResponse toCustomerResponse(Booking booking) {
        return new CustomerBookingResponse(
            booking.getId(),
            booking.getClientName(),
            booking.getClientEmail(),
            booking.getEventDate(),
            booking.getEventTime(),
            booking.getEventType(),
            booking.getLocation(),
            booking.getPackageId(),
            booking.getTotalAmountCents(),
            booking.getDepositAmountCents(),
            booking.getStatus(),
            booking.getCreatedAt()
        );
    }
}
