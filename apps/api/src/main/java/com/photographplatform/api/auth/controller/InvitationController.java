package com.photographplatform.api.auth.controller;

import com.photographplatform.api.auth.dto.AcceptInvitationRequest;
import com.photographplatform.api.auth.dto.InvitationPreviewResponse;
import com.photographplatform.api.auth.service.StaffInvitationService;
import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.tenant.domain.Tenant;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Claiming a seat, from outside the product.
 *
 * <p>Unauthenticated by necessity: the person holding the invitation has no
 * account yet — creating one is the whole point of the call. The token is the
 * only credential, which is why it is a one-time SHA-256-hashed secret with a
 * seven-day life, and why both endpoints answer expired, spent and unknown
 * tokens identically. Distinguishing them would turn this into an oracle for
 * which addresses have been invited to which studio.
 */
@RestController
@RequestMapping("/api/public/invitations")
public class InvitationController {

    private final StaffInvitationService invitationService;

    public InvitationController(StaffInvitationService invitationService) {
        this.invitationService = invitationService;
    }

    /**
     * What the acceptance screen shows before the visitor fills anything in:
     * which studio invited them, and to which address.
     */
    @GetMapping
    public InvitationPreviewResponse preview(@RequestParam @NotBlank String token) {
        StaffInvitationService.Preview preview = invitationService.peek(token);
        Tenant tenant = preview.studio();
        String studio = tenant.getBusinessName() != null && !tenant.getBusinessName().isBlank()
            ? tenant.getBusinessName()
            : tenant.getSubdomain();
        return new InvitationPreviewResponse(studio, preview.email());
    }

    /**
     * Creates the colleague's account and spends the invitation.
     *
     * <p>Answers 204 rather than a session: the new account then signs in
     * through the ordinary login form, which is the path that already handles
     * lockout, rate limiting and refresh-token issuance. Minting a session here
     * would be a second, thinner copy of all of it.
     */
    @PostMapping("/accept")
    public ResponseEntity<Void> accept(
        @Valid @RequestBody AcceptInvitationRequest request,
        HttpServletRequest httpRequest
    ) {
        // accept() either throws or returns the account it just saved — there is
        // no path through it that yields null. The null check that used to
        // guard a 500 here was unreachable, and SpotBugs said so the first time
        // it ran against this project.
        invitationService.accept(
            request.token(),
            request.password(),
            request.fullName(),
            ClientIp.from(httpRequest));
        // The account exists; the client sends the visitor to /login.
        return ResponseEntity.noContent().build();
    }
}
