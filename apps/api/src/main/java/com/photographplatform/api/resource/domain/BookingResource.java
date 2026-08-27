package com.photographplatform.api.resource.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/**
 * A booking holding a resource. Pure link: the pair is the whole row, which is
 * why the primary key is the pair and why deleting the booking takes it.
 */
@Entity
@Table(schema = "public", name = "booking_resources")
@IdClass(BookingResource.Key.class)
public class BookingResource {

    @Id
    @Column(name = "booking_id", nullable = false)
    private UUID bookingId;

    @Id
    @Column(name = "resource_id", nullable = false)
    private UUID resourceId;

    protected BookingResource() {
    }

    public BookingResource(UUID bookingId, UUID resourceId) {
        this.bookingId = bookingId;
        this.resourceId = resourceId;
    }

    public UUID getBookingId() {
        return bookingId;
    }

    public UUID getResourceId() {
        return resourceId;
    }

    /** Composite key. */
    public static class Key implements Serializable {
        private UUID bookingId;
        private UUID resourceId;

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Key key)) {
                return false;
            }
            return Objects.equals(bookingId, key.bookingId)
                && Objects.equals(resourceId, key.resourceId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(bookingId, resourceId);
        }
    }
}
