package com.photographplatform.api.booking.controller;

import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.UpdateBookingStatusRequest;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    @GetMapping("/api/customerBookings")
    public ResponseEntity<List<BookingResponse>> getCustomerBookings(
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam UUID clientId
    ) {
        List<BookingResponse> bookings;

        if (status != null && !status.isEmpty()) {
            bookings = bookingRepository.findByClientIdAndStatus(clientId, status,
                PageRequest.of(page, size, Sort.by("eventDate").ascending()))
                .stream()
                .map(this::toResponse)
                .toList();
        } else {
            bookings = bookingRepository.findByClientIdOrderByEventDateAsc(clientId,
                PageRequest.of(page, size))
                .stream()
                .map(this::toResponse)
                .toList();
        }

        return ResponseEntity.ok(bookings);
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
            booking.getCreatedAt()
        );
    }

    /**
     * Transition a booking to a new status. Returns 409 Conflict on illegal
     * transitions (e.g. ENQUIRY -> COMPLETED) and 404 if the booking is unknown.
     */
    @PatchMapping("/api/bookings/{id}/status")
    public ResponseEntity<BookingResponse> updateStatus(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateBookingStatusRequest request,
        HttpServletRequest httpRequest
    ) {
        BookingResponse updated = bookingService.changeStatus(id, request.status(), httpRequest.getRemoteAddr());
        return ResponseEntity.ok(updated);
    }
}
