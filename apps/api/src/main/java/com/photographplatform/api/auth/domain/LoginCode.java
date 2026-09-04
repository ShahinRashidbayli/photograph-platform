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
 * One-time login code for customer (passwordless) auth.
 *
 * <p>The plaintext code is sent in the email; only {@code sha256(userId + ":" +
 * code)} is persisted, mirroring {@link EmailVerificationToken} and
 * {@link RefreshToken} — with the user id folded in as a per-row salt because a
 * six-digit code is small enough to reverse from an unsalted hash. See
 * {@code V32__login_code_attempts.sql} for the full reasoning and
 * {@code CustomerAuthService} for the attempt cap that bounds guessing.
 *
 * <p>Retains the {@code magic_link_tokens} table name while the class carries
 * the new one. The table holds the same primitive it always did — a short-lived,
 * single-use, hashed login secret — and renaming a table under a foreign key
 * costs a migration to buy nothing. The Java name is free to be accurate, and
 * paying for the cheap half of a rename is better than keeping a class called
 * after a mechanism the code no longer has.
 */
@Entity
@Table(schema = "public", name = "magic_link_tokens")
public class LoginCode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "used_at")
    private OffsetDateTime usedAt;

    @Column(name = "attempts", nullable = false)
    private int attempts = 0;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected LoginCode() {
    }

    public LoginCode(UUID userId, String tokenHash, OffsetDateTime expiresAt) {
        this.userId = userId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

    public OffsetDateTime getUsedAt() {
        return usedAt;
    }

    public void markUsed() {
        this.usedAt = OffsetDateTime.now();
    }

    public boolean isUsed() {
        return usedAt != null;
    }

    public boolean isExpired() {
        return expiresAt.isBefore(OffsetDateTime.now());
    }

    public int getAttempts() {
        return attempts;
    }

    /** Records a failed guess. The caller enforces the cap. */
    public void recordFailedAttempt() {
        this.attempts++;
    }
}
