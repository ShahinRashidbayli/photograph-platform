package com.photographplatform.api.auth.repository;

import com.photographplatform.api.auth.domain.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * <h2>Why there is no {@code findByEmail(String)}</h2>
 * There was, and it returned an {@code Optional} — a promise that one address
 * means one account platform-wide. The schema never made that true: a customer
 * of two photographers legitimately holds a row in each tenant, so the query
 * threw {@code IncorrectResultSizeDataAccessException} and took login, password
 * reset, the public portfolio page and watermarking down with it.
 *
 * <p>The replacement splits the query the way the product actually addresses
 * people, and {@code V23__staff_email_uniqueness.sql} makes the database
 * guarantee each half:
 *
 * <ul>
 *   <li>{@link #findStaffByEmail} — for flows that begin with an email and no
 *       tenant (login, password reset). Unique by the partial index.</li>
 *   <li>{@link #findByTenantIdAndEmail} — for everything that already knows
 *       which tenant it means, which is every other caller.</li>
 * </ul>
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByTenantIdAndEmail(UUID tenantId, String email);

    /**
     * Every customer account for an address, one per studio that knows them.
     *
     * <p>Many-valued on purpose — see above: a client of two photographers has
     * two rows. Used only by sign-in by email, which must find them all.
     */
    @Query("SELECT u FROM User u WHERE u.email = :email AND u.role = 'CUSTOMER'")
    java.util.List<User> findCustomersByEmail(@Param("email") String email);

    /**
     * The PHOTOGRAPHER/ADMIN account for an address, if there is one.
     *
     * <p>Single-valued because {@code uq_users_staff_email} enforces it, not
     * because we hope so. Customer rows are excluded rather than merely
     * outranked: they are passwordless, so no password-based flow could
     * authenticate one anyway, and skipping them here means a customer account
     * sharing the address can never shadow the staff account.
     */
    @Query("SELECT u FROM User u WHERE u.email = :email AND u.role <> 'CUSTOMER'")
    Optional<User> findStaffByEmail(@Param("email") String email);

    /**
     * Whether this address already owns a staff account.
     *
     * <p>Scoped to staff on purpose. The old {@code existsByEmail} refused
     * registration to anyone who had ever been someone else's client — which is
     * precisely the person most likely to sign up, having seen the product from
     * the other side.
     */
    @Query("SELECT COUNT(u) > 0 FROM User u WHERE u.email = :email AND u.role <> 'CUSTOMER'")
    boolean existsStaffByEmail(@Param("email") String email);

    /**
     * The photographers in one studio, oldest first, so the owner — who has
     * been there longest — heads the team list.
     */
    @Query("SELECT u FROM User u WHERE u.tenantId = :tenantId AND u.role <> 'CUSTOMER' "
        + "ORDER BY u.staffRole ASC, u.email ASC")
    java.util.List<User> findStaffByTenantId(@Param("tenantId") UUID tenantId);

    /**
     * How many seats this studio currently has filled.
     *
     * <p>Counts staff rows only. Pending invitations are counted separately by
     * {@code StaffInvitationRepository} and added on top before a new one is
     * issued — an invitation that has been sent but not yet accepted has to
     * hold its seat, or a studio on a two-seat plan could invite ten people and
     * let them race for it.
     */
    @Query("SELECT COUNT(u) FROM User u WHERE u.tenantId = :tenantId AND u.role <> 'CUSTOMER'")
    long countStaffByTenantId(@Param("tenantId") UUID tenantId);

    /** The account that owns this studio, if the tenant still has one. */
    @Query("SELECT u FROM User u WHERE u.tenantId = :tenantId AND u.staffRole = "
        + "com.photographplatform.api.auth.domain.StaffRole.OWNER")
    Optional<User> findOwnerByTenantId(@Param("tenantId") UUID tenantId);
}
