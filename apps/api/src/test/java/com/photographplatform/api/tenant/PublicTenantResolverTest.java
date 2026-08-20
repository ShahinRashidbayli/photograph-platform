package com.photographplatform.api.tenant;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Resolution of a public {@code {subdomain}} URL, and the tenant binding the
 * three public endpoints run their work under.
 *
 * <p>The context handling is the part worth pinning: a binding left behind on
 * a pooled request thread would leak one photographer's tenant into the next
 * request served by that thread.
 */
class PublicTenantResolverTest {

    private final TenantRepository tenantRepository = mock(TenantRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final PublicTenantResolver resolver = new PublicTenantResolver(tenantRepository, userRepository);

    @AfterEach
    void clearContext() {
        TenantContext.clear();
    }

    /** A transient tenant — no id, which is all the lookup tests need. */
    private Tenant tenant(String subdomain) {
        return new Tenant(subdomain, "anna@example.test");
    }

    @Test
    void unknownSubdomainIsNotFound() {
        when(tenantRepository.findBySubdomain("nobody")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resolver.requireBySubdomain("nobody"))
            .isInstanceOf(NotFoundException.class)
            .hasMessageContaining("nobody");
    }

    @Test
    void displayNameComesFromTheOwnerUser() {
        Tenant anna = tenant("anna-foto");
        when(tenantRepository.findBySubdomain("anna-foto")).thenReturn(Optional.of(anna));
        User owner = new User(UUID.randomUUID(), "anna@example.test", "hash", "Anna Müller");
        owner.setAvatarUrl("avatars/anna.jpg");
        when(userRepository.findByEmail("anna@example.test")).thenReturn(Optional.of(owner));

        var photographer = resolver.requirePhotographer("anna-foto");

        assertThat(photographer.displayName()).isEqualTo("Anna Müller");
        assertThat(photographer.avatarUrl()).isEqualTo("avatars/anna.jpg");
    }

    /**
     * A tenant whose owner row is missing or unnamed still has a public page.
     * Falling back to the subdomain keeps it rendering instead of 500-ing on
     * someone else's incomplete profile.
     */
    @Test
    void missingOwnerFallsBackToTheSubdomain() {
        Tenant anna = tenant("anna-foto");
        when(tenantRepository.findBySubdomain("anna-foto")).thenReturn(Optional.of(anna));
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        var photographer = resolver.requirePhotographer("anna-foto");

        assertThat(photographer.displayName()).isEqualTo("anna-foto");
        assertThat(photographer.avatarUrl()).isNull();
    }

    @Test
    void unnamedOwnerAlsoFallsBackToTheSubdomain() {
        Tenant anna = tenant("anna-foto");
        when(tenantRepository.findBySubdomain("anna-foto")).thenReturn(Optional.of(anna));
        when(userRepository.findByEmail(anyString()))
            .thenReturn(Optional.of(new User(UUID.randomUUID(), "anna@example.test", "hash", null)));

        assertThat(resolver.requirePhotographer("anna-foto").displayName()).isEqualTo("anna-foto");
    }

    // ── tenant binding ────────────────────────────────────────────────────

    @Test
    void workRunsWithTheTenantBound() {
        Tenant anna = persisted("anna-foto");

        String seen = resolver.inTenantContext(anna, TenantContext::getTenant);

        assertThat(seen).isEqualTo(anna.getId().toString());
    }

    /** The unauthenticated case: nothing was bound, so nothing is left behind. */
    @Test
    void bindingIsClearedWhenThereWasNoneBefore() {
        Tenant anna = persisted("anna-foto");

        resolver.inTenantContext(anna, () -> null);

        assertThat(TenantContext.getTenant()).isNull();
    }

    /**
     * If a tenant was already bound, it must come back — clearing it instead
     * would make every later query in that request fail closed under RLS, and
     * the symptom is an empty result rather than an error.
     */
    @Test
    void previousBindingIsRestored() {
        String caller = UUID.randomUUID().toString();
        TenantContext.setTenant(caller);

        resolver.inTenantContext(persisted("anna-foto"), () -> null);

        assertThat(TenantContext.getTenant()).isEqualTo(caller);
    }

    @Test
    void bindingIsRestoredEvenWhenTheWorkThrows() {
        String caller = UUID.randomUUID().toString();
        TenantContext.setTenant(caller);

        assertThatThrownBy(() -> resolver.inTenantContext(persisted("anna-foto"), () -> {
            throw new IllegalStateException("boom");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(TenantContext.getTenant()).isEqualTo(caller);
    }

    /** A Tenant with an id, which only the persistence layer normally assigns. */
    private Tenant persisted(String subdomain) {
        Tenant t = tenant(subdomain);
        try {
            var field = Tenant.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(t, UUID.randomUUID());
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        return t;
    }
}
