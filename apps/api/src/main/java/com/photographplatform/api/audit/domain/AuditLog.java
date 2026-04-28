package com.photographplatform.api.audit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(schema = "public", name = "audit_log")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(name = "entity_type", length = 50)
    private String entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "old_value", columnDefinition = "jsonb")
    private String oldValue;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_value", columnDefinition = "jsonb")
    private String newValue;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected AuditLog() {
    }

    private AuditLog(Builder builder) {
        this.tenantId = builder.tenantId;
        this.actorId = builder.actorId;
        this.action = builder.action;
        this.entityType = builder.entityType;
        this.entityId = builder.entityId;
        this.oldValue = builder.oldValue;
        this.newValue = builder.newValue;
        this.ipAddress = builder.ipAddress;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public UUID getActorId() {
        return actorId;
    }

    public String getAction() {
        return action;
    }

    public String getEntityType() {
        return entityType;
    }

    public UUID getEntityId() {
        return entityId;
    }

    public String getOldValue() {
        return oldValue;
    }

    public String getNewValue() {
        return newValue;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public static Builder builder(String action) {
        return new Builder(action);
    }

    public static final class Builder {
        private final String action;
        private UUID tenantId;
        private UUID actorId;
        private String entityType;
        private UUID entityId;
        private String oldValue;
        private String newValue;
        private String ipAddress;

        private Builder(String action) {
            this.action = action;
        }

        public Builder tenantId(UUID tenantId) {
            this.tenantId = tenantId;
            return this;
        }

        public Builder actorId(UUID actorId) {
            this.actorId = actorId;
            return this;
        }

        public Builder entityType(String entityType) {
            this.entityType = entityType;
            return this;
        }

        public Builder entityId(UUID entityId) {
            this.entityId = entityId;
            return this;
        }

        public Builder oldValue(String oldValue) {
            this.oldValue = oldValue;
            return this;
        }

        public Builder newValue(String newValue) {
            this.newValue = newValue;
            return this;
        }

        public Builder ipAddress(String ipAddress) {
            this.ipAddress = ipAddress;
            return this;
        }

        public AuditLog build() {
            return new AuditLog(this);
        }
    }
}
