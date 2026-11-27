package com.photographplatform.api.audit;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.StaffRole;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.service.BookingCommandService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.LocalDate;
import java.util.UUID;
import java.util.function.LongSupplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * When an audit row appears, relative to the thing it describes.
 *
 * <p>Auditing used to write from an {@code @Async} method, which commits on its
 * own thread independently of the caller. An operation that failed afterwards
 * therefore left a row behind naming an entity that was never persisted — and a
 * trail that records things which did not happen is worse than one with gaps,
 * because a false row is indistinguishable from a true one and is exactly what
 * someone reading the trail is relying on.
 */
class AuditAfterCommitIT extends IntegrationTestBase {

    @Autowired private BookingCommandService commandService;
    @Autowired private AuditService auditService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PlatformTransactionManager txManager;

    private static final String IP = "203.0.113.17";

    @Test
    void anOperationThatSucceedsIsAudited() {
        Fixture fx = createTenant();

        asUser(fx, () -> commandService.createBooking(request(null), IP));

        assertThat(awaitRows(() -> auditRowsFor(fx, "BOOKING_CREATED"), 1)).isEqualTo(1);
    }

    /**
     * A real audited operation whose transaction is rolled back afterwards.
     *
     * <p>The service joins the surrounding transaction, so its entry is held
     * for a commit that never comes. Deliberately not a booking that fails on
     * its own inputs: those fail before the audit call is reached, so such a
     * test would pass against the old behaviour too and prove nothing.
     */
    @Test
    void anAuditedOperationInsideARolledBackTransactionLeavesNoRow() {
        Fixture fx = createTenant();

        assertThatThrownBy(() -> asUser(fx, () -> new TransactionTemplate(txManager).execute(status -> {
            commandService.createBooking(request(null), IP);
            throw new IllegalStateException("something later in the unit of work failed");
        }))).isInstanceOf(IllegalStateException.class);

        drainAuditWrites(fx);
        assertThat(auditRowsFor(fx, "BOOKING_CREATED")).isZero();
        // And the booking itself is gone, so a row here would name nothing.
        assertThat(countAcrossTenants(
            "SELECT count(*) FROM bookings WHERE tenant_id = ?", fx.tenantId())).isZero();
    }

    /**
     * The rollback that motivated the change, reduced to its shape: publish,
     * then fail. Nothing should reach the table.
     */
    @Test
    void anEntryPublishedInADoomedTransactionIsNeverWritten() {
        Fixture fx = createTenant();
        UUID entityId = UUID.randomUUID();

        assertThatThrownBy(() -> asUser(fx, () -> new TransactionTemplate(txManager).execute(status -> {
            auditService.log("TEST_ROLLED_BACK", "BOOKING", entityId, fx.tenantId(), fx.userId(), IP);
            throw new IllegalStateException("rolled back after publishing");
        })));

        drainAuditWrites(fx);
        assertThat(auditRowsForEntity(entityId)).isZero();
    }

    /**
     * Auth paths publish outside a transaction on purpose — {@code
     * AuthService#login} says so. A transactional listener drops those silently
     * unless it declares {@code fallbackExecution}, and a silently unaudited
     * login is the worst outcome an audit change can have.
     */
    @Test
    void anEntryPublishedOutsideATransactionIsStillWritten() {
        Fixture fx = createTenant();
        UUID entityId = UUID.randomUUID();

        asUser(fx, () -> {
            auditService.logQuietly("TEST_NO_TX", "USER", entityId, fx.tenantId(), fx.userId(), IP);
            return null;
        });

        assertThat(awaitRows(() -> auditRowsForEntity(entityId), 1)).isEqualTo(1);
    }

    // ── waiting for an off-thread write ──────────────────────────────────────

    private static final long TIMEOUT_MS = 5_000;
    private static final long POLL_MS = 25;

    /** Polls until the count reaches {@code expected}, or gives up and returns what it saw. */
    private long awaitRows(LongSupplier count, long expected) {
        long deadline = System.currentTimeMillis() + TIMEOUT_MS;
        long seen;
        while ((seen = count.getAsLong()) != expected && System.currentTimeMillis() < deadline) {
            try {
                Thread.sleep(POLL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        return seen;
    }

    /**
     * Makes "no row was written" mean something.
     *
     * <p>The write is off the request thread, so asserting zero straight after
     * a failure would also pass against the old behaviour — it would just be
     * asking before the row arrived. This pushes a known-good entry through the
     * same executor and waits for it: once that one has landed, anything queued
     * ahead of it has too, and zero is a fact rather than a race.
     */
    private void drainAuditWrites(Fixture fx) {
        UUID barrier = UUID.randomUUID();
        asUser(fx, () -> {
            auditService.log("TEST_BARRIER", "USER", barrier, fx.tenantId(), fx.userId(), IP);
            return null;
        });
        assertThat(awaitRows(() -> auditRowsForEntity(barrier), 1))
            .as("audit executor drained").isEqualTo(1);
    }

    // ── fixtures ─────────────────────────────────────────────────────────────

    private record Fixture(UUID tenantId, UUID userId) {
    }

    private long auditRowsFor(Fixture fx, String action) {
        return countAcrossTenants(
            "SELECT count(*) FROM audit_log WHERE tenant_id = ? AND action = ?",
            fx.tenantId(), action);
    }

    private long auditRowsForEntity(UUID entityId) {
        return countAcrossTenants("SELECT count(*) FROM audit_log WHERE entity_id = ?", entityId);
    }

    private CreateBookingRequest request(UUID packageId) {
        return new CreateBookingRequest(
            "Maria Kellner", "maria@example.test", LocalDate.now().plusDays(30),
            null, "WEDDING", "Berlin", null, packageId, 50_000, null, null, null, null, null);
    }

    private Fixture createTenant() {
        UUID tenantId = new TransactionTemplate(txManager).execute(s -> tenantRepository.save(
            new Tenant("audit-test-" + UUID.randomUUID(),
                "owner-" + UUID.randomUUID() + "@example.test")).getId());
        UUID userId = asTenant(tenantId, () -> new TransactionTemplate(txManager).execute(s -> {
            User staff = new User(tenantId, "photographer-" + UUID.randomUUID() + "@example.test",
                "hash", "Anna");
            staff.setStaffRole(StaffRole.OWNER);
            return userRepository.save(staff).getId();
        }));
        return new Fixture(tenantId, userId);
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
