package com.photographplatform.api.resource.repository;

import com.photographplatform.api.resource.domain.BookingResource;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingResourceRepository
    extends JpaRepository<BookingResource, BookingResource.Key> {

    List<BookingResource> findByBookingId(UUID bookingId);

    void deleteByBookingId(UUID bookingId);
}
