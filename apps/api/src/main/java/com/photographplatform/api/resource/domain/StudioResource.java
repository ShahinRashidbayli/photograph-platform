package com.photographplatform.api.resource.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Something a shoot needs besides a photographer — a room, a lighting kit, a
 * second body.
 *
 * <p>Rooms and equipment share one entity because the studio asks the same
 * question of both: is it free that day. {@code kind} only decides how the UI
 * groups them.
 */
@Entity
@Table(schema = "public", name = "studio_resources")
public class StudioResource {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 20)
    private String kind = "EQUIPMENT";

    @Column(columnDefinition = "TEXT")
    private String notes;

    /**
     * Retired resources stay. One that shot fifty bookings cannot be deleted
     * without losing the record of what shot them, and selling a lens is not a
     * reason to lose last year's history.
     */
    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected StudioResource() {
    }

    public StudioResource(UUID tenantId, String name, String kind) {
        this.tenantId = tenantId;
        this.name = name;
        this.kind = kind;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
