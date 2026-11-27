package com.photographplatform.api.client.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * A photographer's private notes about one client (V40).
 *
 * <p>The only part of the client directory that is not derived from bookings,
 * so the only part stored. Keyed by the client's normalised address, the
 * same identity the directory groups bookings by; a row exists only once a
 * note has been written, and is deleted when the note is cleared.
 */
@Entity
@Table(name = "client_notes")
public class ClientNote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(nullable = false, updatable = false, length = 320)
    private String email;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String notes;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected ClientNote() {
    }

    public ClientNote(UUID tenantId, String normalizedEmail, String notes) {
        this.tenantId = tenantId;
        this.email = normalizedEmail;
        this.notes = notes;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public String getEmail() {
        return email;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
