package com.photographplatform.api.inquiry.domain;

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
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "inquiry_requests")
public class InquiryRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(name = "event_type", nullable = false, length = 20)
    private String eventType;

    @Column(name = "budget_range", nullable = false, length = 20)
    private String budgetRange;

    @Column(name = "proposed_date", nullable = false)
    private LocalDate proposedDate;

    @Column(length = 200)
    private String location;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(nullable = false, length = 10)
    private String score = "MED";

    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @Column(nullable = false, length = 30)
    private String source = "BIO_LINK";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected InquiryRequest() {
    }

    public InquiryRequest(UUID customerId, String eventType, String budgetRange,
                          LocalDate proposedDate, String location, String message,
                          String score, String source) {
        this.customerId = customerId;
        this.eventType = eventType;
        this.budgetRange = budgetRange;
        this.proposedDate = proposedDate;
        this.location = location;
        this.message = message;
        this.score = score;
        this.source = source;
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

    public UUID getCustomerId() {
        return customerId;
    }

    public String getEventType() {
        return eventType;
    }

    public String getBudgetRange() {
        return budgetRange;
    }

    public LocalDate getProposedDate() {
        return proposedDate;
    }

    public String getLocation() {
        return location;
    }

    public String getMessage() {
        return message;
    }

    public String getScore() {
        return score;
    }

    public String getStatus() {
        return status;
    }

    public String getSource() {
        return source;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
