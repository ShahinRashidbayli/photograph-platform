package com.photographplatform.api.booking.controller;

import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.dto.CustomerBookingResponse;
import com.photographplatform.api.booking.dto.UpdateBookingStatusRequest;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingService;
import com.photographplatform.api.common.security.RequiresVerifiedEmail;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BookingController {

    private final BookingRepository bookingRepository;
    private final BookingService bookingService;

    public BookingController(BookingRepository bookingRepository, BookingService bookingService) {
        this.bookingRepository = bookingRepository;
        this.bookingService = bookingService;
    }

    /**
     * Photographer-facing list of every booking in the tenant. Restricted to
     * PHOTOGRAPHER/ADMIN by {@code SecurityConfig} — the response carries
     * client PII and internal notes, so a CUSTOMER token must not reach it.
     */
    @GetMapping("/api/photographerBookings")
    public ResponseEntity<List<BookingResponse>> getPhotographerBookings(
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        List<BookingResponse> bookings;

        if (status != null && !status.isEmpty()) {
            bookings = bookingRepository.findByStatus(status,
                PageRequest.of(page, size, Sort.by("eventDate").ascending()))
                .stream()
                .map(this::toResponse)
                .toList();
        } else {
            bookings = bookingRepository.findByOrderByEventDateAsc(
                PageRequest.of(page, size))
                .stream()
                .map(this::toResponse)
                .toList();
        }

        return ResponseEntity.ok(bookings);
    }

    /**
     * Bookings owned by the currently authenticated customer.
     *
     * <p>The customer is identified from their JWT — there is deliberately no
     * {@code clientId} parameter. Trusting a caller-supplied id here was an
     * IDOR: any customer could read any other customer's bookings. The service
     * resolves the principal to an email and scopes the query to it.
     */
    @GetMapping("/api/customerBookings")
    public ResponseEntity<List<CustomerBookingResponse>> getCustomerBookings(
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(bookingService.getOwnBookings(status, page, size));
    }

    /**
     * Create a booking. The new booking starts in {@code ENQUIRY}; subsequent
     * lifecycle moves go through {@link #updateStatus}. Restricted to
     * PHOTOGRAPHER/ADMIN by {@code SecurityConfig}.
     */
    @PostMapping("/api/bookings")
    public ResponseEntity<BookingResponse> createBooking(
        @Valid @RequestBody CreateBookingRequest request,
        HttpServletRequest httpRequest
    ) {
        BookingResponse created = bookingService.createBooking(request, httpRequest.getRemoteAddr());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Transition a booking to a new status. Returns 409 Conflict on illegal
     * transitions (e.g. ENQUIRY -> COMPLETED) and 404 if the booking is unknown.
     *
     * <p>Gated on verified email: status changes trigger client-facing emails
     * (deposit requests, confirmations) — those should not go out under an
     * unverified photographer identity.
     */
    @RequiresVerifiedEmail
    @PatchMapping("/api/bookings/{id}/status")
    public ResponseEntity<BookingResponse> updateStatus(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateBookingStatusRequest request,
        HttpServletRequest httpRequest
    ) {
        BookingResponse updated = bookingService.changeStatus(id, request.status(), httpRequest.getRemoteAddr());
        return ResponseEntity.ok(updated);
    }

    private BookingResponse toResponse(com.photographplatform.api.booking.domain.Booking booking) {
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
}
