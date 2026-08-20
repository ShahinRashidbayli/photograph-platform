package com.photographplatform.api.client;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.client.dto.ClientResponse;
import com.photographplatform.api.client.dto.UpdateClientNotesRequest;
import com.photographplatform.api.client.service.ClientService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The client directory against a real Postgres.
 *
 * <p>These cover the behaviour that moved out of {@code ClientController} when
 * it grew a service — in particular the notes update, which previously
 * answered {@code 200} with an empty body for an id that did not exist,
 * reporting success for a write that never happened.
 */
class ClientServiceIT extends IntegrationTestBase {

    @Autowired private ClientService clientService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private PlatformTransactionManager txManager;

    @Test
    void unknownClientIsReportedAsNotFound() {
        Fixture fx = createTenant();

        assertThatThrownBy(() -> asUser(fx, () ->
            clientService.updateNotes(UUID.randomUUID(), new UpdateClientNotesRequest("hi"), "203.0.113.5")))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void notesAreSavedAndReturnedWithDerivedStats() {
        Fixture fx = createTenant();
        UUID clientId = createClient(fx, "maria@example.test", "Maria Kellner");

        ClientResponse updated = asUser(fx, () ->
            clientService.updateNotes(clientId, new UpdateClientNotesRequest("  Prefers morning shoots  "),
                "203.0.113.5"));

        assertThat(updated.id()).isEqualTo(clientId);
        assertThat(updated.notes()).isEqualTo("Prefers morning shoots");
        assertThat(updated.fullName()).isEqualTo("Maria Kellner");
        // Comes from the projection, not the entity — proving the response is
        // read back through findStatsById rather than mapped off the row saved.
        assertThat(updated.upcomingBookings()).isZero();
        assertThat(updated.totalBookings()).isZero();
    }

    /** A blank body clears the notes rather than storing whitespace. */
    @Test
    void blankNotesAreStoredAsNull() {
        Fixture fx = createTenant();
        UUID clientId = createClient(fx, "jonas@example.test", "Jonas Weber");

        asUser(fx, () -> clientService.updateNotes(clientId, new UpdateClientNotesRequest("something"), null));
        ClientResponse cleared = asUser(fx, () ->
            clientService.updateNotes(clientId, new UpdateClientNotesRequest("   "), null));

        assertThat(cleared.notes()).isNull();
    }

    @Test
    void listReturnsOnlyTheCallersOwnTenant() {
        Fixture a = createTenant();
        Fixture b = createTenant();
        createClient(a, "a-client@example.test", "A Client");
        createClient(b, "b-client@example.test", "B Client");

        List<ClientResponse> visibleToA = asUser(a, () -> clientService.list());

        assertThat(visibleToA).extracting(ClientResponse::fullName).containsExactly("A Client");
    }

    /**
     * RLS is the tenant boundary, so an id from another tenant must not even
     * resolve — it reports "not found" rather than leaking that it exists.
     */
    @Test
    void aClientFromAnotherTenantCannotBeUpdated() {
        Fixture a = createTenant();
        Fixture b = createTenant();
        UUID clientOfB = createClient(b, "b-client@example.test", "B Client");

        assertThatThrownBy(() -> asUser(a, () ->
            clientService.updateNotes(clientOfB, new UpdateClientNotesRequest("nosy"), null)))
            .isInstanceOf(NotFoundException.class);
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    private record Fixture(UUID tenantId, UUID userId) {
    }

    private Fixture createTenant() {
        UUID tenantId = new TransactionTemplate(txManager).execute(status -> tenantRepository.save(
            new Tenant("client-test-" + UUID.randomUUID(),
                "owner-" + UUID.randomUUID() + "@example.test")).getId());
        UUID userId = asTenant(tenantId, () -> userRepository.save(
            new User(tenantId, "photographer-" + UUID.randomUUID() + "@example.test", "hash", "Anna")).getId());
        return new Fixture(tenantId, userId);
    }

    /**
     * Inserted with SQL rather than through the entity on purpose: {@code
     * Client} exposes no public constructor and no setters for email/name,
     * because <em>nothing in the application writes this table</em> — rows
     * would come from the booking flow, which does not create them yet. The
     * read and update paths still have to be correct for the day it does.
     */
    private UUID createClient(Fixture fx, String email, String fullName) {
        UUID id = UUID.randomUUID();
        asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager).execute(status -> {
            entityManager.createNativeQuery("""
                INSERT INTO clients (id, tenant_id, email, full_name)
                VALUES (:id, :tenantId, :email, :fullName)
                """)
                .setParameter("id", id)
                .setParameter("tenantId", fx.tenantId())
                .setParameter("email", email)
                .setParameter("fullName", fullName)
                .executeUpdate();
            return null;
        }));
        return id;
    }

    private <T> T asUser(Fixture fx, java.util.function.Supplier<T> action) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(fx.userId().toString(), null));
        TenantContext.setTenant(fx.tenantId().toString());
        try {
            return action.get();
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    private <T> T asTenant(UUID tenantId, java.util.function.Supplier<T> action) {
        TenantContext.setTenant(tenantId.toString());
        try {
            return action.get();
        } finally {
            TenantContext.clear();
        }
    }
}
