package com.photographplatform.api.auth.repository;

import com.photographplatform.api.auth.domain.StaffInvitation;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Pending and settled seat invitations.
 *
 * <p>Lookups are by token hash, never by plaintext — the plaintext only ever
 * exists in the email that carried it.
 */
public interface StaffInvitationRepository extends JpaRepository<StaffInvitation, UUID> {

    /**
     * The invitation a token belongs to, whatever state it is in.
     *
     * <p>Deliberately not filtered to pending ones: accepting an expired or
     * already-used token has to be told apart from accepting a token that was
     * never issued. The first is "ask for a new invitation", the second is
     * someone guessing, and answering both the same way makes the real case
     * unhelpful to the colleague sitting in front of it.
     */
    Optional<StaffInvitation> findByTokenHash(String tokenHash);

    /**
     * What the team screen lists — every invitation this studio has issued,
     * newest first.
     */
    List<StaffInvitation> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    /**
     * Invitations that still hold a seat: not accepted, not revoked, not
     * expired.
     *
     * <p>Added to the filled-seat count before a new invitation is issued.
     * Leaving them out would let a studio on a three-seat plan send ten
     * invitations and hand the plan limit to whoever clicked first.
     */
    @Query("SELECT COUNT(i) FROM StaffInvitation i WHERE i.tenantId = :tenantId "
        + "AND i.acceptedAt IS NULL AND i.revokedAt IS NULL AND i.expiresAt > :now")
    long countPending(@Param("tenantId") UUID tenantId, @Param("now") OffsetDateTime now);

    /**
     * The live invitation for one address in one studio, if there is one.
     *
     * <p>At most one can exist — {@code uq_staff_invitations_pending} (V25)
     * enforces it — so re-inviting somebody replaces their invitation rather
     * than issuing a second token against the same seat.
     */
    @Query("SELECT i FROM StaffInvitation i WHERE i.tenantId = :tenantId "
        + "AND LOWER(i.email) = LOWER(:email) "
        + "AND i.acceptedAt IS NULL AND i.revokedAt IS NULL")
    Optional<StaffInvitation> findLiveByEmail(@Param("tenantId") UUID tenantId,
                                              @Param("email") String email);
}
