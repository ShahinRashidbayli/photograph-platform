package com.photographplatform.api.lead.domain;

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
@Table(name = "leads")
public class Lead {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 320)
    private String email;

    @Column(length = 30)
    private String phone;

    @Column(name = "event_date")
    private LocalDate eventDate;

    @Column(name = "event_type", length = 50)
    private String eventType;

    @Column(name = "budget_range", length = 30)
    private String budgetRange;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "internal_notes", columnDefinition = "TEXT")
    private String internalNotes;

    @Column(nullable = false, length = 10)
    private String score = "LOW";

    @Column(nullable = false, length = 20)
    private String status = "NEW";

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(length = 30)
    private String source;

    @Column(name = "ig_message_id", length = 100)
    private String igMessageId;

    @Column(name = "ig_username", length = 100)
    private String igUsername;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected Lead() {
    }

    public Lead(String name, String email, String phone, LocalDate eventDate, String eventType,
                String budgetRange, String message, String ipAddress) {
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.eventDate = eventDate;
        this.eventType = eventType;
        this.budgetRange = budgetRange;
        this.message = message;
        this.ipAddress = ipAddress;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public LocalDate getEventDate() {
        return eventDate;
    }

    public void setEventDate(LocalDate eventDate) {
        this.eventDate = eventDate;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getBudgetRange() {
        return budgetRange;
    }

    public void setBudgetRange(String budgetRange) {
        this.budgetRange = budgetRange;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getInternalNotes() {
        return internalNotes;
    }

    public void setInternalNotes(String internalNotes) {
        this.internalNotes = internalNotes;
    }

    public String getScore() {
        return score;
    }

    public void setScore(String score) {
        this.score = score;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getIgMessageId() {
        return igMessageId;
    }

    public void setIgMessageId(String igMessageId) {
        this.igMessageId = igMessageId;
    }

    public String getIgUsername() {
        return igUsername;
    }

    public void setIgUsername(String igUsername) {
        this.igUsername = igUsername;
    }
}
