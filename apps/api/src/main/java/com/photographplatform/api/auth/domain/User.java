package com.photographplatform.api.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "public", name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(nullable = false, length = 320)
    private String email;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 20)
    private String role = "PHOTOGRAPHER";

    /**
     * Standing inside the studio — see {@link StaffRole}.
     *
     * <p>Null for customers, and never null for staff; {@code
     * chk_users_staff_role} (V25) holds both halves of that. It is left null
     * here rather than defaulted, because the right value depends on how the
     * account came to exist: registering creates a studio and its
     * {@code OWNER}, accepting an invitation joins one as a {@code MEMBER}.
     * A default would silently make every invited colleague an owner.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "staff_role", length = 20)
    private StaffRole staffRole;

    @Column(name = "full_name", length = 200)
    private String fullName;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;

    @Column(name = "email_verified_at")
    private OffsetDateTime emailVerifiedAt;

    /**
     * Access tokens issued before this instant are refused.
     *
     * <p>The only way to revoke a JWT this application issues — see
     * {@code SessionRevocation}. NULL means nothing has been revoked.
     */
    @Column(name = "tokens_valid_after")
    private OffsetDateTime tokensValidAfter;

    protected User() {
    }

    public User(UUID tenantId, String email, String passwordHash, String fullName) {
        this.tenantId = tenantId;
        this.email = email;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
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

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public StaffRole getStaffRole() {
        return staffRole;
    }

    public void setStaffRole(StaffRole staffRole) {
        this.staffRole = staffRole;
    }

    /**
     * Whether this account may change what the studio pays for and who is in
     * it. False for members and for customers, so callers can ask without
     * first checking which kind of account they hold.
     */
    public boolean isOwner() {
        return staffRole != null && staffRole.isOwner();
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public OffsetDateTime getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(OffsetDateTime lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    public OffsetDateTime getTokensValidAfter() {
        return tokensValidAfter;
    }

    public void setTokensValidAfter(OffsetDateTime tokensValidAfter) {
        this.tokensValidAfter = tokensValidAfter;
    }

    public OffsetDateTime getEmailVerifiedAt() {
        return emailVerifiedAt;
    }

    public void setEmailVerifiedAt(OffsetDateTime emailVerifiedAt) {
        this.emailVerifiedAt = emailVerifiedAt;
    }

    public boolean isEmailVerified() {
        return emailVerifiedAt != null;
    }
}
