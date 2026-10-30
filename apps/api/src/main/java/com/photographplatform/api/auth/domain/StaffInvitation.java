package com.photographplatform.api.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A pending seat in a studio.
 *
 * <p>The row is the invitation, not the person: an invited photographer has no
 * {@code users} row until they accept. That is what makes a revoked invitation
 * leave nothing behind, and what makes a seat count only the colleagues who
 * actually hold one.
 *
 * <p>Same shape as the other one-time tokens in this schema — the plaintext
 * goes out in the email and only its SHA-256 hash is stored, so a database
 * compromise cannot be replayed into someone else's studio.
 */
@Entity
@Table(schema = "public", name = "staff_invitations")
public class StaffInvitation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(nullable = false, length = 320)
    private String email;

    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    private String tokenHash;

    /**
     * The account that sent it, or null once that account has been deleted.
     * Removing the person who invited a colleague must not remove the
     * colleague, so the FK is ON DELETE SET NULL rather than a cascade.
     */
    @Column(name = "invited_by")
    private UUID invitedBy;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "accepted_at")
    private OffsetDateTime acceptedAt;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected StaffInvitation() {
    }

    public StaffInvitation(UUID tenantId, String email, String tokenHash,
                           UUID invitedBy, OffsetDateTime expiresAt) {
        this.tenantId = tenantId;
        this.email = email;
        this.tokenHash = tokenHash;
        this.invitedBy = invitedBy;
        this.expiresAt = expiresAt;
    }

    /**
     * Whether this invitation can still be accepted.
     *
     * <p>Asks the three questions together because answering only one of them
     * is the classic way a revoked or spent token stays usable.
     */
    public boolean isPending(OffsetDateTime now) {
        return acceptedAt == null && revokedAt == null && expiresAt.isAfter(now);
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

    public String getTokenHash() {
        return tokenHash;
    }

    public UUID getInvitedBy() {
        return invitedBy;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

    public OffsetDateTime getAcceptedAt() {
        return acceptedAt;
    }

    public void setAcceptedAt(OffsetDateTime acceptedAt) {
        this.acceptedAt = acceptedAt;
    }

    public OffsetDateTime getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(OffsetDateTime revokedAt) {
        this.revokedAt = revokedAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
