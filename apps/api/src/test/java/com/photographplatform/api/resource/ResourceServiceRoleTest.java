package com.photographplatform.api.resource;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.resource.dto.ResourceRequest;
import com.photographplatform.api.resource.repository.StudioResourceRepository;
import com.photographplatform.api.resource.service.ResourceService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * The studio's rooms and kit are staff property, asserted here rather than
 * only in {@code SecurityConfig}.
 *
 * <p>The URL rule is the gate that matters in production, and it is in place
 * (see {@code EndpointRoleMatrixIT}). This is the second lock on the same door:
 * the rule lives in one file, several prefixes away from the service it
 * protects, and BUG-004 exists because exactly that kind of distance let a
 * whole prefix go unruled. A service that decides for itself who may write to
 * it cannot be reopened by an editing mistake in a configuration class.
 *
 * <p>Reads are deliberately left alone: the URL rule covers them, and the
 * damage BUG-004 describes — a customer creating and renaming the studio's own
 * inventory — is on the write path.
 */
class ResourceServiceRoleTest {

    private final StudioResourceRepository repository = mock(StudioResourceRepository.class);
    private final ResourceService service = new ResourceService(repository);

    private static final ResourceRequest REQUEST =
        new ResourceRequest("Studio A", "ROOM", null, null);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    /**
     * Set up exactly what {@code JwtAuthFilter} leaves behind for a valid
     * token: the user id as the principal, one {@code ROLE_<role>} authority,
     * and the tenant bound in {@link TenantContext}.
     *
     * <p>The tenant matters. Without it {@code requireCurrentTenantId()} throws
     * {@code UnauthorizedException} on its own, and a test asserting that
     * exception would pass whether or not a role check exists at all — green
     * for the wrong reason, which is worse than red.
     */
    private static void authenticateAs(String role) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                UUID.randomUUID(), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
        TenantContext.setTenant(UUID.randomUUID().toString());
    }

    @Test
    void aCustomerCannotCreateAResource() {
        authenticateAs("CUSTOMER");

        assertThatThrownBy(() -> service.create(REQUEST))
            .isInstanceOf(UnauthorizedException.class);

        verify(repository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void aCustomerCannotUpdateAResource() {
        authenticateAs("CUSTOMER");

        assertThatThrownBy(() -> service.update(UUID.randomUUID(), REQUEST))
            .isInstanceOf(UnauthorizedException.class);

        // Refused before the row is even loaded: a customer should not be able
        // to tell an existing resource id from one that was never issued.
        verify(repository, never()).findById(org.mockito.ArgumentMatchers.any());
    }

    /**
     * The guard has to refuse the customer without refusing the people whose
     * inventory this is — a check that denies everyone passes the test above
     * and breaks the feature.
     */
    @Test
    void staffAreNotRefusedByTheGuard() {
        for (String role : List.of("PHOTOGRAPHER", "ADMIN")) {
            SecurityContextHolder.clearContext();
            authenticateAs(role);

            assertThatCode(() -> service.update(UUID.randomUUID(), REQUEST))
                .as("%s must pass the role guard", role)
                .isNotInstanceOf(UnauthorizedException.class);
        }
    }
}
