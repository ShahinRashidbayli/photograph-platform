package com.photographplatform.api.booking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "bookings")
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "client_id")
    private UUID clientId;

    @Column(name = "lead_id")
    private UUID leadId;

    @Column(name = "client_name", nullable = false, length = 200)
    private String clientName;

    @Column(name = "client_email", nullable = false, length = 320)
    private String clientEmail;

    @Column(name = "event_date", nullable = false)
    private LocalDate eventDate;

    @Column(name = "event_time")
    private LocalTime eventTime;

    @Column(name = "event_type", length = 50)
    private String eventType;

    @Column(name = "location", length = 300)
    private String location;

    @Column(name = "package_id")
    private UUID packageId;

    @Column(name = "total_amount_cents", nullable = false)
    private Integer totalAmountCents = 0;

    @Column(name = "deposit_amount_cents", nullable = false)
    private Integer depositAmountCents = 0;

    @Column(nullable = false, length = 30)
    private String status = "ENQUIRY";

    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    protected Booking() {
    }

    public Booking(String clientName, String clientEmail, LocalDate eventDate) {
        this.clientName = clientName;
        this.clientEmail = clientEmail;
        this.eventDate = eventDate;
    }

    public UUID getId() {
        return id;
    }

    public UUID getClientId() {
        return clientId;
    }

    public void setClientId(UUID clientId) {
        this.clientId = clientId;
    }

    public UUID getLeadId() {
        return leadId;
    }

    public void setLeadId(UUID leadId) {
        this.leadId = leadId;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getClientEmail() {
        return clientEmail;
    }

    public void setClientEmail(String clientEmail) {
        this.clientEmail = clientEmail;
    }

    public LocalDate getEventDate() {
        return eventDate;
    }

    public void setEventDate(LocalDate eventDate) {
        this.eventDate = eventDate;
    }

    public LocalTime getEventTime() {
        return eventTime;
    }

    public void setEventTime(LocalTime eventTime) {
        this.eventTime = eventTime;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public UUID getPackageId() {
        return packageId;
    }

    public void setPackageId(UUID packageId) {
        this.packageId = packageId;
    }

    public Integer getTotalAmountCents() {
        return totalAmountCents;
    }

    public void setTotalAmountCents(Integer totalAmountCents) {
        this.totalAmountCents = totalAmountCents;
    }

    public Integer getDepositAmountCents() {
        return depositAmountCents;
    }

    public void setDepositAmountCents(Integer depositAmountCents) {
        this.depositAmountCents = depositAmountCents;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getInternalNotes() {
        return internalNotes;
    }

    public void setInternalNotes(String internalNotes) {
        this.internalNotes = internalNotes;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
