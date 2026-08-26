package com.photographplatform.api.auth.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.StaffInvitation;
import com.photographplatform.api.auth.domain.StaffRole;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.StaffInvitationRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.PlanUpgradeRequiredException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.util.HtmlEscape;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.common.util.TokenUtils;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.email.EmailTemplate;
import com.photographplatform.api.notification.service.EmailService;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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

    private static final Logger LOG = LoggerFactory.getLogger(StaffInvitationService.class);

    /**
     * Long enough to survive a holiday, short enough that a forwarded mailbox
     * is not a standing key to someone's studio.
     */
    private static final Duration TOKEN_TTL = Duration.ofDays(7);

    private final StaffInvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final EntitlementService entitlementService;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final Clock clock;
    private final String webBaseUrl;

    public StaffInvitationService(
        StaffInvitationRepository invitationRepository,
        UserRepository userRepository,
        TenantRepository tenantRepository,
        EntitlementService entitlementService,
        EmailService emailService,
        PasswordEncoder passwordEncoder,
        AuditService auditService,
        Clock clock,
        @Value("${app.web.base-url:http://localhost:3000}") String webBaseUrl
    ) {
        this.invitationRepository = invitationRepository;
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.entitlementService = entitlementService;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.clock = clock;
        this.webBaseUrl = webBaseUrl;
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

    // ── Inviting ──────────────────────────────────────────────────────────────

    /**
     * Issues an invitation and emails it.
     *
     * <p>Only the owner may call this — {@link #requireOwner} is the gate, and
     * it is here rather than in the controller so every future caller inherits
     * it.
     *
     * @throws PlanUpgradeRequiredException when the studio has no seat free
     */
    @Transactional
    public StaffInvitation invite(UUID tenantId, UUID actorId, String rawEmail, String ipAddress) {
        User actor = requireOwner(tenantId, actorId);
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
            throw new PlanUpgradeRequiredException(
                "Your plan includes " + seats + (seats == 1 ? " seat" : " seats"),
                Plan.STUDIO);
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
        requireOwner(tenantId, actorId);
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
        requireOwner(tenantId, actorId);
        User member = userRepository.findById(memberId)
            .filter(u -> u.getTenantId().equals(tenantId))
            .orElseThrow(() -> new NotFoundException("Member not found"));

        if (member.isOwner()) {
            throw new ConflictException("The studio owner cannot be removed");
        }
        userRepository.delete(member);
        auditService.logQuietly("STAFF_REMOVED", "USER", memberId, tenantId, actorId, ipAddress);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * The gate for every seat operation.
     *
     * <p>Answers 403-shaped situations with {@link UnauthorizedException}
     * because that is what the rest of this service does for "you may not",
     * and the caller is authenticated either way.
     */
    private User requireOwner(UUID tenantId, UUID actorId) {
        User actor = userRepository.findById(actorId)
            .filter(u -> u.getTenantId().equals(tenantId))
            .orElseThrow(() -> new UnauthorizedException("Not your studio"));
        if (!actor.isOwner()) {
            throw new UnauthorizedException("Only the studio owner can manage the team");
        }
        return actor;
    }

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
        String link = webBaseUrl.replaceAll("/+$", "") + "/invite?token=" + rawToken;
        String studio = tenant.getBusinessName() != null && !tenant.getBusinessName().isBlank()
            ? tenant.getBusinessName() : tenant.getSubdomain();
        String from = inviter.getFullName() != null && !inviter.getFullName().isBlank()
            ? inviter.getFullName() : inviter.getEmail();

        String html = EmailTemplate.document(
            "You have been invited to " + studio + " on Fotolio",
            EmailTemplate.heading("Join " + HtmlEscape.escape(studio))
                + EmailTemplate.paragraph(HtmlEscape.escape(from)
                    + " has invited you to work in their studio on Fotolio. Accepting gives you "
                    + "access to the studio's bookings, clients and galleries.")
                + EmailTemplate.button("Accept invitation", link)
                + EmailTemplate.note("Or paste this link into your browser:<br>"
                    + "<span style=\"word-break:break-all;\">" + HtmlEscape.escape(link) + "</span>")
                + EmailTemplate.note("This invitation expires in 7 days. If you were not "
                    + "expecting it, you can safely ignore this email."));
        try {
            emailService.send(new EmailMessage(email, "You have been invited to " + studio, html));
        } catch (RuntimeException ex) {
            // Best-effort, like every other outbound mail here: the invitation
            // exists and the owner can resend it.
            LOG.warn("Failed to send staff invitation to {}", email, ex);
        }
    }
}
