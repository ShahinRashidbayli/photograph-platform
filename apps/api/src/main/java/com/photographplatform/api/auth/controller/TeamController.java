package com.photographplatform.api.auth.controller;

import com.photographplatform.api.auth.domain.StaffInvitation;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.dto.InviteStaffRequest;
import com.photographplatform.api.auth.dto.TeamInvitationResponse;
import com.photographplatform.api.auth.dto.TeamMemberResponse;
import com.photographplatform.api.auth.dto.TeamResponse;
import com.photographplatform.api.auth.dto.TransferOwnershipRequest;
import com.photographplatform.api.auth.service.AvatarUrlResolver;
import com.photographplatform.api.auth.service.StaffInvitationService;
import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.common.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The studio's team — who is in it, who has been invited, and how many seats
 * the plan allows.
 *
 * <p>Role-gated to PHOTOGRAPHER/ADMIN by {@code SecurityConfig} like the rest
 * of {@code /api/**}. The finer gate — that only the <em>owner</em> may invite
 * or remove — lives in {@link StaffInvitationService}, not here: reading the
 * team is something every colleague may do, and putting the ownership check in
 * the controller would mean the next caller of that service silently skips it.
 */
@RestController
@RequestMapping("/api/team")
public class TeamController {

    private final StaffInvitationService invitationService;
    private final AvatarUrlResolver avatarUrlResolver;
    private final Clock clock;

    public TeamController(
        StaffInvitationService invitationService,
        AvatarUrlResolver avatarUrlResolver,
        Clock clock
    ) {
        this.invitationService = invitationService;
        this.avatarUrlResolver = avatarUrlResolver;
        this.clock = clock;
    }

    @GetMapping
    public TeamResponse team() {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID userId = SecurityUtils.requireCurrentUserId();

        List<TeamMemberResponse> members = invitationService.listStaff(tenantId).stream()
            .map(this::toMember)
            .toList();

        // Settled invitations stay in the list so the owner can see that a seat
        // was offered and declined, rather than wondering whether the mail was
        // ever sent.
        OffsetDateTime now = OffsetDateTime.now(clock);
        List<TeamInvitationResponse> invitations = invitationService.listInvitations(tenantId)
            .stream()
            .map(i -> toInvitation(i, now))
            .toList();

        return new TeamResponse(members, invitations,
            invitationService.seatsUsed(tenantId),
            invitationService.seatsAllowed(tenantId),
            invitationService.canManageTeam(userId));
    }

    @PostMapping("/invitations")
    public ResponseEntity<TeamInvitationResponse> invite(
        @Valid @RequestBody InviteStaffRequest request,
        HttpServletRequest httpRequest
    ) {
        StaffInvitation invitation = invitationService.invite(
            SecurityUtils.requireCurrentTenantId(),
            SecurityUtils.requireCurrentUserId(),
            request.email(),
            ClientIp.from(httpRequest));
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(toInvitation(invitation, OffsetDateTime.now(clock)));
    }

    @DeleteMapping("/invitations/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id, HttpServletRequest httpRequest) {
        invitationService.revoke(
            SecurityUtils.requireCurrentTenantId(),
            SecurityUtils.requireCurrentUserId(),
            id,
            ClientIp.from(httpRequest));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/members/{id}")
    public ResponseEntity<Void> removeMember(@PathVariable UUID id, HttpServletRequest httpRequest) {
        invitationService.removeMember(
            SecurityUtils.requireCurrentTenantId(),
            SecurityUtils.requireCurrentUserId(),
            id,
            ClientIp.from(httpRequest));
        return ResponseEntity.noContent().build();
    }

    /**
     * Hands the studio to a colleague.
     *
     * <p>The caller becomes an ordinary member in the same request, so this is
     * the last owner-only action they can take. Answers 204: the client reloads
     * rather than patching state, because what the whole shell offers changes.
     */
    @PostMapping("/transfer-ownership")
    public ResponseEntity<Void> transferOwnership(
        @Valid @RequestBody TransferOwnershipRequest request,
        HttpServletRequest httpRequest
    ) {
        invitationService.transferOwnership(
            SecurityUtils.requireCurrentTenantId(),
            SecurityUtils.requireCurrentUserId(),
            request.memberId(),
            ClientIp.from(httpRequest));
        return ResponseEntity.noContent().build();
    }

    /**
     * Leaving the studio. Not owner-gated — this is the one team operation a
     * member performs on themselves, and gating it to owners would recreate the
     * problem it exists to solve.
     */
    @PostMapping("/leave")
    public ResponseEntity<Void> leave(HttpServletRequest httpRequest) {
        invitationService.leaveStudio(
            SecurityUtils.requireCurrentTenantId(),
            SecurityUtils.requireCurrentUserId(),
            ClientIp.from(httpRequest));
        return ResponseEntity.noContent().build();
    }

    private TeamMemberResponse toMember(User user) {
        return new TeamMemberResponse(
            user.getId(),
            user.getEmail(),
            user.getFullName(),
            user.getStaffRole(),
            avatarUrlResolver.resolve(user.getAvatarUrl()));
    }

    /**
     * Computes the status server-side. "Expired" is not a stored state — it is
     * a pending row whose deadline has passed — and leaving the client to work
     * that out means every client has to agree about the clock.
     */
    private TeamInvitationResponse toInvitation(StaffInvitation i, OffsetDateTime now) {
        String status;
        if (i.getAcceptedAt() != null) {
            status = "ACCEPTED";
        } else if (i.getRevokedAt() != null) {
            status = "REVOKED";
        } else if (!i.getExpiresAt().isAfter(now)) {
            status = "EXPIRED";
        } else {
            status = "PENDING";
        }
        return new TeamInvitationResponse(
            i.getId(), i.getEmail(), status, i.getExpiresAt(), i.getCreatedAt());
    }
}
