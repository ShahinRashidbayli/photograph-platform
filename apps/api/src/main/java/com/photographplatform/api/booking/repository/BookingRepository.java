package com.photographplatform.api.booking.repository;

import com.photographplatform.api.booking.domain.Booking;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingRepository extends JpaRepository<Booking, UUID> {
    Page<Booking> findByStatus(String status, Pageable pageable);

    Page<Booking> findByOrderByEventDateAsc(Pageable pageable);

    Page<Booking> findByClientIdOrderByEventDateAsc(UUID clientId, Pageable pageable);

    Page<Booking> findByClientIdAndStatus(UUID clientId, String status, Pageable pageable);
}
