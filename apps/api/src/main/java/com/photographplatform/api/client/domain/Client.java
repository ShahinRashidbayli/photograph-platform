package com.photographplatform.api.client.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "clients")
public class Client {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 320)
    private String email;

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;

    @Column(length = 30)
    private String phone;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(length = 30)
    private String source;

    @Column(name = "total_bookings", nullable = false)
    private Integer totalBookings = 0;

    @Column(name = "total_spent_cents", nullable = false)
    private Integer totalSpentCents = 0;

    @Column(name = "last_booking_date")
    private LocalDate lastBookingDate;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected Client() {
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getFullName() {
        return fullName;
    }

    public String getPhone() {
        return phone;
    }

    public String getNotes() {
        return notes;
    }

    public String getSource() {
        return source;
    }

    public Integer getTotalBookings() {
        return totalBookings;
    }

    public Integer getTotalSpentCents() {
        return totalSpentCents;
    }

    public LocalDate getLastBookingDate() {
        return lastBookingDate;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
