package com.photographplatform.api.auth;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.StaffInvitationRepository;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.auth.service.OwnershipGuard;
import com.photographplatform.api.auth.service.StaffInvitationService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.notification.service.EmailService;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

/**
 * Leaving a studio is something staff do, and the service says so itself.
 *
 * <p>{@code POST /api/team/leave} is now closed to customers by the
 * {@code /api/team/**} rule, which is the gate that runs in production. This is
 * the second lock, for the same reason the one in {@code ResourceService} is
 * there (BUG-004): the rule lives in a configuration class several prefixes
 * away, and BUG-008 happened because nothing near the code itself objected.
 *
 * <p>What made BUG-008 more than an access-control slip is what the handler
 * does when it is reached. {@code leaveStudio} looks the caller up, finds they
 * are not the owner, and deletes their row — so a customer calling the staff
 * surface deleted their own account, and the trail recorded it as
 * {@code STAFF_LEFT}, which is not what happened.
 */
class LeaveStudioRoleTest {

    private final StaffInvitationRepository invitationRepository =
        mock(StaffInvitationRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final AuditService auditService = mock(AuditService.class);

    private final StaffInvitationService service = new StaffInvitationService(
        invitationRepository,
        userRepository,
        mock(TenantRepository.class),
        mock(EntitlementService.class),
        mock(OwnershipGuard.class),
        mock(EmailService.class),
        mock(PasswordEncoder.class),
        auditService,
        Clock.systemUTC(),
        "http://localhost:3000");

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    /**
     * The context {@code JwtAuthFilter} leaves behind for a valid token. The
     * tenant matters: without it the tenant lookup throws on its own and the
     * assertion below would pass with no role check present at all.
     */
    private static void authenticateAs(String role) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                UUID.randomUUID(), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
        TenantContext.setTenant(UUID.randomUUID().toString());
    }

    private static final UUID TENANT = UUID.randomUUID();
    private static final UUID ACTOR = UUID.randomUUID();

    /**
     * A member of the studio who does not own it — the state in which
     * {@code leaveStudio} does its work rather than refusing.
     *
     * <p>Without this the caller is simply not found, the method throws
     * "Not your studio", and a test asserting {@code UnauthorizedException}
     * passes whether or not a role check exists. That is the version of this
     * test that was written first, and it was green before the fix.
     */
    private void actorIsAMemberOfTheStudio() {
        User actor = new User(TENANT, "someone@example.com", "hash", "Someone");
        when(userRepository.findById(ACTOR)).thenReturn(Optional.of(actor));
    }

    @Test
    void aCustomerCannotLeaveTheStudio() {
        authenticateAs("CUSTOMER");
        actorIsAMemberOfTheStudio();

        assertThatThrownBy(() -> service.leaveStudio(TENANT, ACTOR, "203.0.113.1"))
            .isInstanceOf(UnauthorizedException.class)
            .hasMessageContaining("staff");

        // The account survives, and nothing claims a colleague walked out.
        verify(userRepository, never()).delete(any());
        verify(auditService, never())
            .logQuietly(any(), any(), any(), any(), any(), any());
    }

    /**
     * A guard that refuses everyone would pass the test above and break the
     * feature, so the staff roles have to get through and actually leave.
     */
    @Test
    void staffCanStillLeave() {
        for (String role : List.of("PHOTOGRAPHER", "ADMIN")) {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
            authenticateAs(role);
            actorIsAMemberOfTheStudio();

            service.leaveStudio(TENANT, ACTOR, "203.0.113.1");
        }

        verify(userRepository, org.mockito.Mockito.times(2)).delete(any());
    }
}
