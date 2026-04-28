package com.photographplatform.api.booking.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import java.util.UUID;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    public BookingService(
        BookingRepository bookingRepository,
        UserRepository userRepository,
        AuditService auditService
    ) {
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
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
            .map(u -> u.getTenantId())
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
            booking.getCreatedAt()
        );
    }
}
