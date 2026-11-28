package com.photographplatform.api.auth.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.StaffInvitation;
import com.photographplatform.api.auth.domain.StaffRole;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.StaffInvitationRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.PlanUpgradeRequiredException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.common.util.TokenUtils;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.service.EmailService;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seats: inviting a photographer into a studio, and accepting that invitation.
 *
 * <p>The seat limit is the plan's, and it is counted as <em>staff + live
 * invitations</em>. Counting only staff would let a studio on three seats send
 * ten invitations and hand the limit to whoever clicked first — the limit has
 * to bind at the moment it is issued, because that is the moment somebody is
 * told they have a seat.
 */
@Service
public class StaffInvitationService {

    /**
     * Long enough to survive a holiday, short enough that a forwarded mailbox
     * is not a standing key to someone's studio.
     */
    private static final Duration TOKEN_TTL = Duration.ofDays(7);

    private final StaffInvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final EntitlementService entitlementService;
    private final OwnershipGuard ownershipGuard;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final Clock clock;

    public StaffInvitationService(
        StaffInvitationRepository invitationRepository,
        UserRepository userRepository,
        TenantRepository tenantRepository,
        EntitlementService entitlementService,
        OwnershipGuard ownershipGuard,
        EmailService emailService,
        PasswordEncoder passwordEncoder,
        AuditService auditService,
        Clock clock
    ) {
        this.invitationRepository = invitationRepository;
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.entitlementService = entitlementService;
        this.ownershipGuard = ownershipGuard;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.clock = clock;
    }

    // ── Reading ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<User> listStaff(UUID tenantId) {
        return userRepository.findStaffByTenantId(tenantId);
    }

    @Transactional(readOnly = true)
    public List<StaffInvitation> listInvitations(UUID tenantId) {
        return invitationRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
    }

    /** Seats filled, counting people who hold one and people on their way in. */
    @Transactional(readOnly = true)
    public long seatsUsed(UUID tenantId) {
        return userRepository.countStaffByTenantId(tenantId)
            + invitationRepository.countPending(tenantId, OffsetDateTime.now(clock));
    }

    /**
     * Seats the tenant's plan grants, defaulting to one for a tenant that has
     * somehow lost its row. Sits here beside {@link #seatsUsed} rather than in
     * the controller: the two numbers are only meaningful as a pair, and the
     * controller reaching for {@code TenantRepository} to get the second half
     * was what put a repository call in the layer least able to reuse or test
     * it (see {@code ArchitectureTest}).
     */
    @Transactional(readOnly = true)
    public int seatsAllowed(UUID tenantId) {
        return tenantRepository.findById(tenantId)
            .map(t -> entitlementService.forTenant(t).seats())
            .orElse(1);
    }

    /**
     * Whether this user may invite, remove or hand over seats. Only the owner
     * may; an unknown user may not, rather than defaulting open.
     */
    @Transactional(readOnly = true)
    public boolean canManageTeam(UUID userId) {
        return userRepository.findById(userId).map(User::isOwner).orElse(false);
    }

    // ── Inviting ──────────────────────────────────────────────────────────────

    /**
     * Issues an invitation and emails it.
     *
     * <p>Only the owner may call this — {@link OwnershipGuard} is the gate, and
     * it is here rather than in the controller so every future caller inherits
     * it.
     *
     * @throws PlanUpgradeRequiredException when the studio has no seat free
     */
    @Transactional
    public StaffInvitation invite(UUID tenantId, UUID actorId, String rawEmail, String ipAddress) {
        User actor = ownershipGuard.requireOwner(tenantId, actorId);
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Studio not found"));
        entitlementService.requireWritable(tenant);

        String email = Normalize.email(rawEmail);
        if (email.equalsIgnoreCase(actor.getEmail())) {
            throw new ConflictException("You are already in this studio");
        }
        // Already a colleague here. Checked before the seat count so the
        // message names the real problem rather than "no seats left".
        if (userRepository.findByTenantIdAndEmail(tenantId, email).isPresent()) {
            throw new ConflictException("That person is already in your studio");
        }
        // V23: one address holds at most one staff account platform-wide, so an
        // address that already runs its own studio cannot join a second one.
        // Better a clear 409 now than a constraint violation on accept, when
        // the invited person is the one looking at the error.
        if (userRepository.existsStaffByEmail(email)) {
            throw new ConflictException(
                "That email already has a Fotolio studio account");
        }

        int seats = entitlementService.forTenant(tenant).seats();
        if (seatsUsed(tenantId) >= seats) {
            throw PlanUpgradeRequiredException.limitReached(
                "Your plan includes " + seats + (seats == 1 ? " seat" : " seats"),
                Plan.STUDIO.name());
        }

        // Re-inviting replaces rather than adds: two live tokens for one
        // address means revoking one leaves the other working.
        invitationRepository.findLiveByEmail(tenantId, email)
            .ifPresent(existing -> existing.setRevokedAt(OffsetDateTime.now(clock)));
        invitationRepository.flush();

        String rawToken = TokenUtils.generateSecureToken();
        StaffInvitation invitation = new StaffInvitation(
            tenantId,
            email,
            TokenUtils.sha256(rawToken),
            actorId,
            OffsetDateTime.now(clock).plus(TOKEN_TTL)
        );
        try {
            invitationRepository.saveAndFlush(invitation);
        } catch (DataIntegrityViolationException ex) {
            // uq_staff_invitations_pending — two owners inviting the same
            // person at once. The other one won; nothing was lost.
            throw new ConflictException("An invitation to that address is already pending");
        }

        auditService.logQuietly("STAFF_INVITED", "USER", invitation.getId(),
            tenantId, actorId, ipAddress);
        sendInvitationEmail(tenant, actor, email, rawToken);
        return invitation;
    }

    /**
     * Withdraws a pending invitation, freeing its seat.
     *
     * <p>An accepted one cannot be revoked — that colleague already has an
     * account, and taking it back is removal, not revocation.
     */
    @Transactional
    public void revoke(UUID tenantId, UUID actorId, UUID invitationId, String ipAddress) {
        ownershipGuard.requireOwner(tenantId, actorId);
        StaffInvitation invitation = invitationRepository.findById(invitationId)
            .filter(i -> i.getTenantId().equals(tenantId))
            .orElseThrow(() -> new NotFoundException("Invitation not found"));

        if (invitation.getAcceptedAt() != null) {
            throw new ConflictException("That invitation has already been accepted");
        }
        if (invitation.getRevokedAt() != null) {
            return;
        }
        invitation.setRevokedAt(OffsetDateTime.now(clock));
        auditService.logQuietly("STAFF_INVITE_REVOKED", "USER", invitationId,
            tenantId, actorId, ipAddress);
    }

    // ── Accepting ─────────────────────────────────────────────────────────────

    /** The studio and the address an invitation names. See {@link #peek}. */
    public record Preview(Tenant studio, String email) {
    }

    /**
     * What a token resolves to, for the acceptance screen to show before the
     * visitor commits to anything.
     *
     * <p>Returns both halves together so the caller validates the token once.
     * Two lookups would mean two chances to disagree about whether it is still
     * valid, with an account created against the second answer.
     *
     * <p>Throws the same {@link UnauthorizedException} for expired, spent and
     * unknown tokens — a screen that distinguishes them is a probe for which
     * addresses have been invited where.
     */
    @Transactional(readOnly = true)
    public Preview peek(String rawToken) {
        StaffInvitation invitation = loadPending(rawToken);
        Tenant tenant = tenantRepository.findById(invitation.getTenantId())
            .orElseThrow(() -> new UnauthorizedException("Invalid or expired invitation"));
        return new Preview(tenant, invitation.getEmail());
    }

    /**
     * Consumes an invitation, creating the colleague's account as a
     * {@link StaffRole#MEMBER}.
     *
     * <p>The seat limit is re-checked here, not only at invite time: seats can
     * be issued and then lost, either because the studio downgraded or because
     * two invitations were accepted in the same minute. Whoever accepts second
     * is told the studio is full rather than silently overfilling it.
     */
    @Transactional
    public User accept(String rawToken, String password, String fullName, String ipAddress) {
        StaffInvitation invitation = loadPending(rawToken);
        Tenant tenant = tenantRepository.findById(invitation.getTenantId())
            .orElseThrow(() -> new UnauthorizedException("Invalid or expired invitation"));

        int seats = entitlementService.forTenant(tenant).seats();
        if (userRepository.countStaffByTenantId(tenant.getId()) >= seats) {
            throw new ConflictException(
                "This studio has no seats left. Ask the owner to free one or upgrade.");
        }
        if (userRepository.existsStaffByEmail(invitation.getEmail())) {
            throw new ConflictException("That email already has a Fotolio studio account");
        }

        User user = new User(
            tenant.getId(),
            invitation.getEmail(),
            passwordEncoder.encode(password),
            fullName == null ? null : fullName.trim()
        );
        user.setRole("PHOTOGRAPHER");
        user.setStaffRole(StaffRole.MEMBER);
        // The invitation went to this address and only its holder could open
        // it, which is the same proof the verification mail asks for.
        user.setEmailVerifiedAt(OffsetDateTime.now(clock));

        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("That email already has a Fotolio studio account");
        }

        invitation.setAcceptedAt(OffsetDateTime.now(clock));
        auditService.logQuietly("STAFF_INVITE_ACCEPTED", "USER", user.getId(),
            tenant.getId(), user.getId(), ipAddress);
        return user;
    }

    // ── Removing ──────────────────────────────────────────────────────────────

    /**
     * Removes a colleague from the studio.
     *
     * <p>The owner cannot be removed, by anyone including themselves: the
     * tenant would be left with no account able to manage billing, and nothing
     * in the product could put one back.
     */
    @Transactional
    public void removeMember(UUID tenantId, UUID actorId, UUID memberId, String ipAddress) {
        ownershipGuard.requireOwner(tenantId, actorId);
        User member = userRepository.findById(memberId)
            .filter(u -> u.getTenantId().equals(tenantId))
            .orElseThrow(() -> new NotFoundException("Member not found"));

        if (member.isOwner()) {
            throw new ConflictException("The studio owner cannot be removed");
        }
        userRepository.delete(member);
        auditService.logQuietly("STAFF_REMOVED", "USER", memberId, tenantId, actorId, ipAddress);
    }

    /**
     * Hands the studio to one of its members.
     *
     * <p>The missing half of {@link #leaveStudio}: an owner cannot leave, so
     * without this a studio can never change hands — not on a sale, not when a
     * partnership ends, not when the founder stops shooting. The owner is the
     * only account that can manage billing, so the product has to provide a way
     * to move that, or the answer is a support ticket and a manual UPDATE.
     *
     * <p>Demote-then-promote, each flushed, because {@code uq_users_tenant_owner}
     * allows exactly one OWNER per tenant. Doing it the other way round, or in
     * one flush, hits the index mid-way with two owners and fails. The whole
     * thing is one transaction, so a failure between the two leaves the studio
     * with the owner it started with rather than none.
     *
     * <p>{@code tenants.owner_email} moves too. It is not the source of
     * ownership any more — {@code staff_role} is — but it still addresses lead
     * and enquiry notifications and identifies the Stripe customer, so leaving
     * it behind would keep mailing the former owner about a studio they no
     * longer run.
     */
    @Transactional
    public void transferOwnership(UUID tenantId, UUID actorId, UUID newOwnerId, String ipAddress) {
        User current = ownershipGuard.requireOwner(tenantId, actorId);
        if (current.getId().equals(newOwnerId)) {
            return;
        }

        User target = userRepository.findById(newOwnerId)
            .filter(u -> u.getTenantId().equals(tenantId))
            .orElseThrow(() -> new NotFoundException("Member not found"));
        // Customers share the tenant but are not staff; handing a studio to one
        // would leave it owned by an account that cannot sign in to run it.
        if (target.getStaffRole() == null) {
            throw new ConflictException("That account is not a photographer in this studio");
        }

        current.setStaffRole(StaffRole.MEMBER);
        userRepository.saveAndFlush(current);
        target.setStaffRole(StaffRole.OWNER);
        userRepository.saveAndFlush(target);

        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Studio not found"));
        tenant.setOwnerEmail(target.getEmail());
        tenantRepository.save(tenant);

        auditService.logQuietly("OWNERSHIP_TRANSFERRED", "USER", newOwnerId,
            tenantId, actorId, ipAddress);
    }

    /**
     * A member leaving the studio they were invited into.
     *
     * <p>The counterpart to {@link #removeMember}: same effect, but the person
     * deciding is the one it happens to. Without it a photographer who joins
     * someone's studio has no way out on their own — and because staff emails
     * are globally unique (V23), no way to open a studio of their own either.
     * Their whole account depended on the owner clicking a button, which is the
     * wrong shape for a professional relationship that routinely ends.
     *
     * <p>The account is deleted rather than moved to a fresh tenant. That frees
     * the address, so the ordinary `/register` flow can open a new studio with
     * it — reusing the path that already handles subdomains, trials and the
     * first owner, instead of growing a second one that does the same thing
     * halfway.
     *
     * <p>Nothing of the studio's leaves with them: bookings, clients, galleries
     * and invoices belong to the tenant, not to the account that touched them.
     *
     * @throws ConflictException if the caller owns the studio — an owner
     *         leaving would strand the tenant with nobody able to manage
     *         billing, so ownership has to be handed over first
     */
    @Transactional
    public void leaveStudio(UUID tenantId, UUID actorId, String ipAddress) {
        // Staff only — and here rather than only in SecurityConfig because of
        // what this method does when it is reached. It finds the caller, sees
        // they are not the owner, and deletes their row: for a customer that
        // was their own account, filed in the trail as STAFF_LEFT. See BUG-008.
        SecurityUtils.requireStaff("Only studio staff can leave a studio");
        User actor = userRepository.findById(actorId)
            .filter(u -> u.getTenantId().equals(tenantId))
            .orElseThrow(() -> new UnauthorizedException("Not your studio"));

        if (actor.isOwner()) {
            throw new ConflictException(
                "You own this studio. Hand ownership to someone else before leaving.");
        }

        // Logged before the row goes, or the audit trail loses the actor it is
        // about — audit rows outlive the accounts they describe.
        auditService.logQuietly("STAFF_LEFT", "USER", actorId, tenantId, actorId, ipAddress);
        userRepository.delete(actor);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private StaffInvitation loadPending(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new UnauthorizedException("Invalid or expired invitation");
        }
        StaffInvitation invitation = invitationRepository
            .findByTokenHash(TokenUtils.sha256(rawToken))
            .orElseThrow(() -> new UnauthorizedException("Invalid or expired invitation"));
        if (!invitation.isPending(OffsetDateTime.now(clock))) {
            throw new UnauthorizedException("Invalid or expired invitation");
        }
        return invitation;
    }

    private void sendInvitationEmail(Tenant tenant, User inviter, String email, String rawToken) {
        String studio = tenant.getBusinessName() != null && !tenant.getBusinessName().isBlank()
            ? tenant.getBusinessName() : tenant.getSubdomain();
        String from = inviter.getFullName() != null && !inviter.getFullName().isBlank()
            ? inviter.getFullName() : inviter.getEmail();
        emailService.queue(new OutgoingEmail(
            StaffInvitationEmail.TEMPLATE, email, tenant.getId(),
            new StaffInvitationEmail.Params(studio, from, rawToken, inviter.getLanguage()),
            null, OffsetDateTime.now(clock).plus(TOKEN_TTL)));
    }

}
