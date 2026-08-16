package com.photographplatform.api.booking.repository;

import com.photographplatform.api.booking.domain.Booking;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingRepository extends JpaRepository<Booking, UUID> {
    Page<Booking> findByStatus(String status, Pageable pageable);

    Page<Booking> findByOrderByEventDateAsc(Pageable pageable);

    // Customer-facing lookups are keyed on the booking's client_email rather
    // than client_id: a booking may exist before its Client directory row does
    // (e.g. created straight from a lead), and the authenticated customer's
    // identity is their email. Case-insensitive because emails are stored
    // lower-cased on write but callers should not depend on that.
    Page<Booking> findByClientEmailIgnoreCaseOrderByEventDateAsc(String clientEmail, Pageable pageable);

    Page<Booking> findByClientEmailIgnoreCaseAndStatus(String clientEmail, String status, Pageable pageable);
}
