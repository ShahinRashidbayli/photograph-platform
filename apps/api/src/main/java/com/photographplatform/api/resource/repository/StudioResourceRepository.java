package com.photographplatform.api.resource.repository;

import com.photographplatform.api.resource.domain.StudioResource;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Tenant scoping comes from RLS (V28), as on every other JPA repository here. */
public interface StudioResourceRepository extends JpaRepository<StudioResource, UUID> {

    List<StudioResource> findAllByOrderByKindAscNameAsc();

    List<StudioResource> findByActiveTrueOrderByKindAscNameAsc();

    /**
     * Bookings that already hold any of these resources on that day.
     *
     * <p>Returns the resource alongside the booking, because "the studio is
     * taken" and "the lighting kit is taken" need different answers from the
     * photographer and a single list of booking names cannot tell them apart.
     *
     * <p>Cancelled and declined are excluded for the same reason as the
     * photographer check: a shoot that is not happening holds nothing.
     */
    @Query("""
        SELECT r.name AS resourceName, b.id AS bookingId, b.clientName AS clientName,
               b.eventTime AS eventTime, b.status AS status
        FROM Booking b
        JOIN BookingResource br ON br.bookingId = b.id
        JOIN StudioResource r ON r.id = br.resourceId
        WHERE br.resourceId IN :resourceIds
          AND b.eventDate = :date
          AND b.id <> :excludeId
          AND b.status NOT IN ('CANCELLED', 'DECLINED')
        ORDER BY r.name ASC, b.eventTime ASC NULLS LAST
        """)
    List<ResourceClash> findClashes(
        @Param("resourceIds") Collection<UUID> resourceIds,
        @Param("date") LocalDate date,
        @Param("excludeId") UUID excludeId);

    /** Projection for {@link #findClashes}. */
    interface ResourceClash {
        String getResourceName();

        UUID getBookingId();

        String getClientName();

        java.time.LocalTime getEventTime();

        String getStatus();
    }
}
