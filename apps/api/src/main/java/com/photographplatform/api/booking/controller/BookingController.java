package com.photographplatform.api.booking.controller;

import com.photographplatform.api.booking.dto.BookingConflictResponse;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.dto.CustomerBookingResponse;
import com.photographplatform.api.booking.dto.UpdateBookingRequest;
import com.photographplatform.api.booking.dto.UpdateBookingStatusRequest;
import com.photographplatform.api.booking.service.BookingService;
import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.common.security.RequiresVerifiedEmail;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    /**
     * Photographer-facing list of every booking in the tenant. Restricted to
     * PHOTOGRAPHER/ADMIN by {@code SecurityConfig}.
     */
    @GetMapping("/api/photographerBookings")
    public ResponseEntity<List<BookingResponse>> getPhotographerBookings(
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(bookingService.listForPhotographer(status, page, size));
    }

    /**
     * Bookings owned by the currently authenticated customer.
     * Customer is identified from their JWT — no clientId parameter.
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
     * Whether the assigned photographer is already busy that day.
     *
     * <p>Called by the form as the date and photographer are picked, so the
     * warning appears before the save rather than as a rejection after it. It
     * is a read: nothing here can refuse a booking.
     */
    @GetMapping("/api/bookings/conflicts")
    public BookingConflictResponse conflicts(
        @RequestParam(required = false) UUID assignedUserId,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate eventDate,
        @RequestParam(required = false) UUID excludeBookingId
    ) {
        return bookingService.findConflicts(assignedUserId, eventDate, excludeBookingId);
    }

    @PostMapping("/api/bookings")
    public ResponseEntity<BookingResponse> createBooking(
        @Valid @RequestBody CreateBookingRequest request,
        HttpServletRequest httpRequest
    ) {
        BookingResponse created = bookingService.createBooking(request, ClientIp.from(httpRequest));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Transition a booking to a new status. Returns 409 on illegal transitions,
     * 404 if the booking is unknown.
     */
    @RequiresVerifiedEmail
    @PatchMapping("/api/bookings/{id}/status")
    public ResponseEntity<BookingResponse> updateStatus(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateBookingStatusRequest request,
        HttpServletRequest httpRequest
    ) {
        BookingResponse updated = bookingService.changeStatus(id, request.status(), ClientIp.from(httpRequest));
        return ResponseEntity.ok(updated);
    }

    /**
     * Edit a booking's details (contact, date, pricing, notes). Photographer-only
     * via {@code SecurityConfig}. This is what lets a photographer price a booking
     * created from an accepted inquiry, which starts with no amounts.
     */
    @RequiresVerifiedEmail
    @PatchMapping("/api/bookings/{id}")
    public ResponseEntity<BookingResponse> updateBooking(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateBookingRequest request,
        HttpServletRequest httpRequest
    ) {
        BookingResponse updated = bookingService.updateBooking(id, request, ClientIp.from(httpRequest));
        return ResponseEntity.ok(updated);
    }
}
