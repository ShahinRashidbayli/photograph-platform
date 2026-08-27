package com.photographplatform.api.resource.repository;

import com.photographplatform.api.resource.domain.BookingResource;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingResourceRepository
    extends JpaRepository<BookingResource, BookingResource.Key> {

    List<BookingResource> findByBookingId(UUID bookingId);

    /**
     * Batch form of {@link #findByBookingId}, for a whole page of bookings.
     * The per-row version turned a twenty-booking list into twenty-one
     * queries.
     */
    List<BookingResource> findByBookingIdIn(Collection<UUID> bookingIds);

    void deleteByBookingId(UUID bookingId);
}
