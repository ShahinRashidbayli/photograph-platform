package com.photographplatform.api.roadmap.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

/**
 * One studio saying it wants one unbuilt idea.
 *
 * <p>The identity is the pair, not a surrogate id: "this tenant wants this
 * feature" is either true or it is not, and a table that could hold it twice
 * would report a number nobody should act on.
 */
@Entity
@Table(name = "feature_interest")
@IdClass(FeatureInterest.Key.class)
public class FeatureInterest {

    @Id
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Id
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40, updatable = false)
    private RoadmapFeature feature;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected FeatureInterest() {
        // JPA
    }

    public FeatureInterest(UUID tenantId, RoadmapFeature feature) {
        this.tenantId = tenantId;
        this.feature = feature;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public RoadmapFeature getFeature() {
        return feature;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    /** Composite key. Public because {@code @IdClass} requires JPA to construct it. */
    public static class Key implements Serializable {

        private UUID tenantId;
        private RoadmapFeature feature;

        public Key() {
        }

        public Key(UUID tenantId, RoadmapFeature feature) {
            this.tenantId = tenantId;
            this.feature = feature;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Key key)) {
                return false;
            }
            return Objects.equals(tenantId, key.tenantId) && feature == key.feature;
        }

        @Override
        public int hashCode() {
            return Objects.hash(tenantId, feature);
        }
    }
}
