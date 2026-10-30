package com.photographplatform.api.contract.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * A contract between a photographer and their customer, signed electronically.
 *
 * <p>The lifecycle rules live here rather than in {@code ContractService},
 * because they are what the word "contract" means and every future caller must
 * obey them: text is editable only while nobody has seen it, a signature must
 * record what it signed, and neither signing nor cancelling can be undone. A
 * service that owned these could be bypassed by the next service that forgets.
 *
 * @see ContractStatus for the lifecycle this enforces
 */
@Entity
@Table(name = "contracts")
public class Contract {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "booking_id", nullable = false, updatable = false)
    private UUID bookingId;

    /**
     * Optimistic-lock counter. Signing is a check-then-act over {@link #status}
     * — read "is it still SENT", then write SIGNED — so without this two
     * concurrent submits both pass the check and the second silently overwrites
     * the first signer's evidence. Same reasoning as {@code Booking.version}.
     */
    @Version
    @Column(nullable = false)
    private long version;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContractStatus status = ContractStatus.DRAFT;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "recipient_name", nullable = false, length = 200)
    private String recipientName;

    @Column(name = "recipient_email", nullable = false, length = 255)
    private String recipientEmail;

    @Column(name = "issuer_name", length = 200)
    private String issuerName;

    @Column(name = "issuer_address", length = 500)
    private String issuerAddress;

    @Column(name = "issuer_email", length = 255)
    private String issuerEmail;

    @Column(name = "body_sha256", length = 64)
    private String bodySha256;

    @Column(name = "signer_name", length = 200)
    private String signerName;

    @Column(name = "signer_user_id")
    private UUID signerUserId;

    @Column(name = "signer_ip", length = 64)
    private String signerIp;

    @Column(name = "signer_user_agent", length = 500)
    private String signerUserAgent;

    @Column(name = "signed_at")
    private OffsetDateTime signedAt;

    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    @Column(name = "cancelled_at")
    private OffsetDateTime cancelledAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected Contract() {
        // JPA
    }

    public Contract(UUID tenantId, UUID bookingId, String title, String body,
                    String recipientName, String recipientEmail) {
        this.tenantId = tenantId;
        this.bookingId = bookingId;
        this.title = title;
        this.body = body;
        this.recipientName = recipientName;
        this.recipientEmail = recipientEmail;
        this.status = ContractStatus.DRAFT;
    }

    // ── lifecycle ─────────────────────────────────────────────────────────────

    /** True while the photographer may still change the text. */
    public boolean isEditable() {
        return status == ContractStatus.DRAFT;
    }

    /**
     * Rewrites the draft. Refused once sent, because the recipient has by then
     * been asked to agree to a specific text and editing it underneath them
     * would make the eventual signature attest to something they never read.
     */
    public void edit(String newTitle, String newBody) {
        requireStatus(ContractStatus.DRAFT, "Only a draft contract can be edited");
        this.title = newTitle;
        this.body = newBody;
    }

    /**
     * Freezes the text and hands it to the customer.
     *
     * <p>The issuer identity is copied in here rather than read live at render
     * time: a contract records who the parties were when it was agreed, and the
     * photographer's Settings can legitimately change the day after.
     */
    public void send(OffsetDateTime now, String issuerName, String issuerAddress, String issuerEmail) {
        requireStatus(ContractStatus.DRAFT, "Only a draft contract can be sent");
        this.issuerName = issuerName;
        this.issuerAddress = issuerAddress;
        this.issuerEmail = issuerEmail;
        this.sentAt = now;
        this.status = ContractStatus.SENT;
    }

    /**
     * Records a simple electronic signature (eIDAS Art. 3(10)).
     *
     * <p>The hash is taken over the body <em>as it stands at this instant</em>,
     * which is what makes the signature checkable later: re-hash the stored text
     * and compare. Taking it at send time instead would prove only what was
     * offered, not what was agreed — and the two are the same only because
     * {@link #edit} refuses to run after {@link #send}, which is exactly the
     * kind of invariant that stops being true when someone adds a "just fix the
     * typo" path. Hashing here does not depend on that promise.
     */
    public void sign(String typedName, UUID userId, String ip, String userAgent, OffsetDateTime now) {
        requireStatus(ContractStatus.SENT, "Only a sent contract can be signed");
        this.signerName = typedName;
        this.signerUserId = userId;
        this.signerIp = ip;
        this.signerUserAgent = userAgent;
        this.signedAt = now;
        this.bodySha256 = sha256Hex(this.body);
        this.status = ContractStatus.SIGNED;
    }

    /** Withdraws a contract that has not been signed. */
    public void cancel(OffsetDateTime now) {
        if (status == ContractStatus.SIGNED) {
            throw new IllegalStateException("A signed contract cannot be cancelled");
        }
        if (status == ContractStatus.CANCELLED) {
            throw new IllegalStateException("This contract is already cancelled");
        }
        this.cancelledAt = now;
        this.status = ContractStatus.CANCELLED;
    }

    /**
     * Whether the stored text still hashes to what was signed.
     *
     * <p>Answers "has this document been altered since signature?" — the only
     * question the stored hash exists to answer. False for an unsigned
     * contract, which has nothing to compare against.
     */
    public boolean isIntact() {
        return bodySha256 != null && bodySha256.equals(sha256Hex(body));
    }

    private void requireStatus(ContractStatus expected, String message) {
        if (status != expected) {
            throw new IllegalStateException(
                message + " (this one is " + status.name().toLowerCase(java.util.Locale.ROOT) + ")");
        }
    }

    static String sha256Hex(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException impossible) {
            // SHA-256 is required of every JVM by the platform spec.
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }

    // ── accessors ─────────────────────────────────────────────────────────────

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public UUID getBookingId() {
        return bookingId;
    }

    public ContractStatus getStatus() {
        return status;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public String getRecipientName() {
        return recipientName;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public String getIssuerName() {
        return issuerName;
    }

    public String getIssuerAddress() {
        return issuerAddress;
    }

    public String getIssuerEmail() {
        return issuerEmail;
    }

    public String getBodySha256() {
        return bodySha256;
    }

    public String getSignerName() {
        return signerName;
    }

    public UUID getSignerUserId() {
        return signerUserId;
    }

    public String getSignerIp() {
        return signerIp;
    }

    public String getSignerUserAgent() {
        return signerUserAgent;
    }

    public OffsetDateTime getSignedAt() {
        return signedAt;
    }

    public OffsetDateTime getSentAt() {
        return sentAt;
    }

    public OffsetDateTime getCancelledAt() {
        return cancelledAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
