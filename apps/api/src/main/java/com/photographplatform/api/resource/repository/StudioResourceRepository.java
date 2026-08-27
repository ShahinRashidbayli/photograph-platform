package com.photographplatform.api.resource.repository;

import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.resource.domain.StudioResource;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Tenant scoping comes from RLS (V28), as on every other JPA repository here. */
public interface StudioResourceRepository extends JpaRepository<StudioResource, UUID> {

    /**
     * Which of these ids are this tenant's, as ids.
     *
     * <p>The caller only needs to know what is missing, and loading whole
     * {@code StudioResource} rows to compare a set of keys reads every column
     * of every row to answer a question about none of them. RLS supplies the
     * tenant scoping, which is what makes an absent id and a foreign id the
     * same answer.
     */
    @Query("SELECT r.id FROM StudioResource r WHERE r.id IN :ids")
    Set<UUID> findExistingIds(@Param("ids") Collection<UUID> ids);

    List<StudioResource> findAllByOrderByKindAscNameAsc();

    List<StudioResource> findByActiveTrueOrderByKindAscNameAsc();

    /**
     * Bookings that already hold any of these resources on that day.
     *
     * <p>Returns the resource alongside the booking, because "the studio is
     * taken" and "the lighting kit is taken" need different answers from the
     * photographer and a single list of booking names cannot tell them apart.
     *
     * <p>{@link BookingStatus#NOT_HAPPENING} is excluded for the same reason
     * as the photographer check: a shoot that is not happening holds nothing.
     *
     * @param excludeId the booking being edited, or null to exclude nothing
     */
    @Query("""
        SELECT r.name AS resourceName, b.id AS bookingId, b.clientName AS clientName,
               b.eventTime AS eventTime, b.status AS status
        FROM Booking b
        JOIN BookingResource br ON br.bookingId = b.id
        JOIN StudioResource r ON r.id = br.resourceId
        WHERE br.resourceId IN :resourceIds
          AND b.eventDate = :date
          AND (:excludeId IS NULL OR b.id <> :excludeId)
          AND b.status NOT IN :notHappening
        ORDER BY r.name ASC, b.eventTime ASC NULLS LAST
        """)
    List<ResourceClash> findClashes(
        @Param("resourceIds") Collection<UUID> resourceIds,
        @Param("date") LocalDate date,
        @Param("excludeId") UUID excludeId,
        @Param("notHappening") Collection<BookingStatus> notHappening);

    /** Projection for {@link #findClashes}. */
    interface ResourceClash {
        String getResourceName();

        UUID getBookingId();

        String getClientName();

        java.time.LocalTime getEventTime();

        BookingStatus getStatus();
    }
}
