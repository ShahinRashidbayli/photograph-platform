package com.photographplatform.api.client;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.client.dto.ClientResponse;
import com.photographplatform.api.client.dto.UpdateClientNotesRequest;
import com.photographplatform.api.client.service.ClientService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.util.BusinessZone;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The client directory against a real Postgres.
 *
 * <p>The directory is the studio's bookings grouped by address (V41). It used
 * to read a {@code clients} table that nothing in the application wrote, so
 * every studio but the seeded demo saw an empty page. These tests write
 * bookings, invoices and payments only, never a client, and expect the
 * client to be there.
 */
class ClientServiceIT extends IntegrationTestBase {

    private static final LocalDate TODAY = LocalDate.now(BusinessZone.ID);

    @Autowired private ClientService clientService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager txManager;

    @Test
    void aBookingIsEnoughToMakeAClient() {
        Fixture fx = createTenant();
        booking(fx, "Maria Kellner", "maria@example.test", TODAY.plusDays(30), "ENQUIRY");

        List<ClientResponse> clients = asUser(fx, () -> clientService.list());

        assertThat(clients).singleElement().satisfies(c -> {
            assertThat(c.id()).isNotNull();
            assertThat(c.fullName()).isEqualTo("Maria Kellner");
            assertThat(c.email()).isEqualTo("maria@example.test");
            assertThat(c.totalBookings()).isEqualTo(1);
            assertThat(c.upcomingBookings()).isEqualTo(1);
            assertThat(c.totalSpentCents()).isZero();
            assertThat(c.lastBookingDate()).isNull();
            assertThat(c.createdAt()).isNotNull();
        });
    }

    /** One person, however the address was typed; their name is the latest one used. */
    @Test
    void bookingsGroupByAddressIgnoringCase() {
        Fixture fx = createTenant();
        booking(fx, "Maria Kellner", "maria@example.test", TODAY.minusDays(400), "COMPLETED");
        booking(fx, "Maria Weber", "  MARIA@Example.TEST ", TODAY.plusDays(10), "CONFIRMED");
        booking(fx, "Jonas Weber", "jonas@example.test", TODAY.plusDays(20), "CONFIRMED");

        List<ClientResponse> clients = asUser(fx, () -> clientService.list());

        assertThat(clients).hasSize(2);
        ClientResponse maria = byEmail(clients, "maria@example.test");
        assertThat(maria.fullName()).isEqualTo("Maria Weber");
        assertThat(maria.totalBookings()).isEqualTo(2);
        assertThat(maria.upcomingBookings()).isEqualTo(1);
        assertThat(maria.lastBookingDate()).isEqualTo(TODAY.minusDays(400));
    }

    /**
     * A shoot that is not happening is neither counted nor upcoming, whatever
     * its date — and because nothing is stored, cancelling one shows at once.
     */
    @Test
    void cancelledAndDeclinedBookingsAreNotCounted() {
        Fixture fx = createTenant();
        for (String status : List.of("CONFIRMED", "ENQUIRY", "DECLINED", "CANCELLED")) {
            booking(fx, "Lea Brandt", "lea@example.test", TODAY.plusDays(30), status);
        }
        UUID later = booking(fx, "Lea Brandt", "lea@example.test", TODAY.plusDays(60), "CONFIRMED");

        ClientResponse before = asUser(fx, () -> clientService.list()).get(0);
        inTenant(fx, () -> jdbc.update("UPDATE bookings SET status = 'CANCELLED' WHERE id = ?", later));
        ClientResponse after = asUser(fx, () -> clientService.list()).get(0);

        assertThat(before.totalBookings()).isEqualTo(3);
        assertThat(before.upcomingBookings()).isEqualTo(3);
        assertThat(after.totalBookings()).isEqualTo(2);
        assertThat(after.upcomingBookings()).isEqualTo(2);
    }

    /** Spend is money received — succeeded payments — not what the bookings were priced at. */
    @Test
    void spendIsTheSucceededPaymentsOnTheClientsInvoices() {
        Fixture fx = createTenant();
        UUID first = booking(fx, "Maria", "maria@example.test", TODAY.minusDays(30), "COMPLETED");
        UUID second = booking(fx, "Maria", "Maria@example.test", TODAY.plusDays(30), "CONFIRMED");
        UUID other = booking(fx, "Jonas", "jonas@example.test", TODAY.plusDays(30), "CONFIRMED");
        payment(fx, invoice(fx, first, 1, 100_000), "SUCCEEDED", 100_000);
        UUID secondInvoice = invoice(fx, second, 2, 50_000);
        payment(fx, secondInvoice, "SUCCEEDED", 20_000);
        payment(fx, secondInvoice, "PENDING", 30_000);
        payment(fx, invoice(fx, other, 3, 70_000), "SUCCEEDED", 70_000);

        List<ClientResponse> clients = asUser(fx, () -> clientService.list());

        assertThat(byEmail(clients, "maria@example.test").totalSpentCents()).isEqualTo(120_000);
        assertThat(byEmail(clients, "jonas@example.test").totalSpentCents()).isEqualTo(70_000);
    }

    /** An erased person's bookings stay for the books, but they are nobody's client any more. */
    @Test
    void anonymisedBookingsAreNotClients() {
        Fixture fx = createTenant();
        booking(fx, "[gelöscht]", "erased-" + UUID.randomUUID() + "@erased.invalid", TODAY, "COMPLETED");

        assertThat(asUser(fx, () -> clientService.list())).isEmpty();
    }

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
        booking(fx, "Maria Kellner", "maria@example.test", TODAY.plusDays(5), "CONFIRMED");
        UUID clientId = asUser(fx, () -> clientService.list()).get(0).id();

        ClientResponse updated = asUser(fx, () ->
            clientService.updateNotes(clientId, new UpdateClientNotesRequest("  Prefers morning shoots  "),
                "203.0.113.5"));

        assertThat(updated.id()).isEqualTo(clientId);
        assertThat(updated.notes()).isEqualTo("Prefers morning shoots");
        assertThat(updated.fullName()).isEqualTo("Maria Kellner");
        assertThat(updated.upcomingBookings()).isEqualTo(1);
        assertThat(asUser(fx, () -> clientService.list()).get(0).notes()).isEqualTo("Prefers morning shoots");
    }

    /** The id is derived from the address, so a client keeps theirs as their bookings come and go. */
    @Test
    void theIdIsStableAcrossNewBookings() {
        Fixture fx = createTenant();
        booking(fx, "Maria", "maria@example.test", TODAY.plusDays(5), "CONFIRMED");
        UUID before = asUser(fx, () -> clientService.list()).get(0).id();
        booking(fx, "Maria", "MARIA@example.test", TODAY.plusDays(50), "CONFIRMED");

        assertThat(asUser(fx, () -> clientService.list()).get(0).id()).isEqualTo(before);
    }

    /** A blank body clears the notes, and leaves no empty row behind. */
    @Test
    void blankNotesClearTheNote() {
        Fixture fx = createTenant();
        booking(fx, "Jonas Weber", "jonas@example.test", TODAY.plusDays(5), "CONFIRMED");
        UUID clientId = asUser(fx, () -> clientService.list()).get(0).id();

        asUser(fx, () -> clientService.updateNotes(clientId, new UpdateClientNotesRequest("something"), null));
        ClientResponse cleared = asUser(fx, () ->
            clientService.updateNotes(clientId, new UpdateClientNotesRequest("   "), null));

        assertThat(cleared.notes()).isNull();
        assertThat(inTenant(fx, () -> jdbc.queryForObject("SELECT count(*) FROM client_notes", Integer.class)))
            .isZero();
    }

    @Test
    void listReturnsOnlyTheCallersOwnTenant() {
        Fixture a = createTenant();
        Fixture b = createTenant();
        booking(a, "A Client", "a-client@example.test", TODAY.plusDays(5), "CONFIRMED");
        booking(b, "B Client", "b-client@example.test", TODAY.plusDays(5), "CONFIRMED");

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
        booking(b, "B Client", "b-client@example.test", TODAY.plusDays(5), "CONFIRMED");
        UUID clientOfB = asUser(b, () -> clientService.list()).get(0).id();

        assertThatThrownBy(() -> asUser(a, () ->
            clientService.updateNotes(clientOfB, new UpdateClientNotesRequest("nosy"), null)))
            .isInstanceOf(NotFoundException.class);
    }

    /**
     * Two studios with the same client keep separate notes. Both directories
     * join client_notes by address alone, so this holds only because RLS
     * hides the other studio's row.
     */
    @Test
    void notesAreIsolatedPerStudio() {
        Fixture a = createTenant();
        Fixture b = createTenant();
        booking(a, "Maria", "maria@example.test", TODAY.plusDays(5), "CONFIRMED");
        booking(b, "Maria", "maria@example.test", TODAY.plusDays(5), "CONFIRMED");
        UUID inA = asUser(a, () -> clientService.list()).get(0).id();
        UUID inB = asUser(b, () -> clientService.list()).get(0).id();

        asUser(a, () -> clientService.updateNotes(inA, new UpdateClientNotesRequest("A's note"), null));

        assertThat(inA).isNotEqualTo(inB);
        assertThat(asUser(b, () -> clientService.list()).get(0).notes()).isNull();
        assertThat(inTenant(b, () -> jdbc.queryForObject("SELECT count(*) FROM client_notes", Integer.class)))
            .isZero();
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    private record Fixture(UUID tenantId, UUID userId) {
    }

    private static ClientResponse byEmail(List<ClientResponse> clients, String email) {
        return clients.stream().filter(c -> c.email().equals(email)).findFirst().orElseThrow();
    }

    private UUID booking(Fixture fx, String name, String email, LocalDate eventDate, String status) {
        UUID id = UUID.randomUUID();
        inTenant(fx, () -> jdbc.update("""
            INSERT INTO bookings (id, tenant_id, client_name, client_email, event_date, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """, id, fx.tenantId(), name, email, eventDate, status));
        return id;
    }

    private UUID invoice(Fixture fx, UUID bookingId, int sequence, int totalCents) {
        UUID id = UUID.randomUUID();
        inTenant(fx, () -> jdbc.update("""
            INSERT INTO invoices (id, tenant_id, booking_id, invoice_number, issue_year, sequence_number,
                status, tax_mode, issuer_business_name, issuer_address_line1, issuer_postal_code,
                issuer_city, issuer_country, buyer_name, buyer_email, subtotal_cents, tax_cents, total_cents)
            VALUES (?, ?, ?, ?, 2026, ?, 'ISSUED', 'KLEINUNTERNEHMER', 'Studio', 'Str. 1', '10115',
                'Berlin', 'DE', 'Buyer', 'buyer@example.test', ?, 0, ?)
            """, id, fx.tenantId(), bookingId, "RE-" + sequence, sequence, totalCents, totalCents));
        return id;
    }

    private void payment(Fixture fx, UUID invoiceId, String status, int amountCents) {
        inTenant(fx, () -> jdbc.update("""
            INSERT INTO payments (tenant_id, invoice_id, method, status, amount_cents)
            VALUES (?, ?, 'UEBERWEISUNG', ?, ?)
            """, fx.tenantId(), invoiceId, status, amountCents));
    }

    private Fixture createTenant() {
        UUID tenantId = new TransactionTemplate(txManager).execute(status -> tenantRepository.save(
            new Tenant("client-test-" + UUID.randomUUID(),
                "owner-" + UUID.randomUUID() + "@example.test")).getId());
        Fixture tenantOnly = new Fixture(tenantId, null);
        UUID userId = inTenant(tenantOnly, () -> userRepository.save(
            new User(tenantId, "photographer-" + UUID.randomUUID() + "@example.test", "hash", "Anna")).getId());
        return new Fixture(tenantId, userId);
    }

    private <T> T asUser(Fixture fx, Supplier<T> action) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(fx.userId().toString(), null));
        try {
            return inTenant(fx, action);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    /** Each call in its own transaction, so RLS sees the tenant bound for it. */
    private <T> T inTenant(Fixture fx, Supplier<T> action) {
        TenantContext.setTenant(fx.tenantId().toString());
        try {
            return new TransactionTemplate(txManager).execute(status -> action.get());
        } finally {
            TenantContext.clear();
        }
    }
}
