package com.photographplatform.api.tenant.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(schema = "public", name = "tenants")
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 63)
    private String subdomain;

    @Column(name = "owner_email", nullable = false, unique = true, length = 320)
    private String ownerEmail;

    @Column(nullable = false, length = 20)
    private String plan = "STARTER";

    @Column(name = "schema_name", length = 63, insertable = false, updatable = false)
    private String schemaName;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "trial_ends_at")
    private OffsetDateTime trialEndsAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected Tenant() {
    }

    public Tenant(String subdomain, String ownerEmail) {
        this.subdomain = subdomain;
        this.ownerEmail = ownerEmail;
    }

    public UUID getId() {
        return id;
    }

    public String getSubdomain() {
        return subdomain;
    }

    public void setSubdomain(String subdomain) {
        this.subdomain = subdomain;
    }

    public String getOwnerEmail() {
        return ownerEmail;
    }

    public void setOwnerEmail(String ownerEmail) {
        this.ownerEmail = ownerEmail;
    }

    public String getPlan() {
        return plan;
    }

    public void setPlan(String plan) {
        this.plan = plan;
    }

    public String getSchemaName() {
        return schemaName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OffsetDateTime getTrialEndsAt() {
        return trialEndsAt;
    }

    public void setTrialEndsAt(OffsetDateTime trialEndsAt) {
        this.trialEndsAt = trialEndsAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
