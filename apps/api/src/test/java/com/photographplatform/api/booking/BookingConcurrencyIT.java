package com.photographplatform.api.booking;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.StaffRole;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.dto.UpdateBookingRequest;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingCommandService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.resource.domain.StudioResource;
import com.photographplatform.api.resource.repository.BookingResourceRepository;
import com.photographplatform.api.resource.repository.StudioResourceRepository;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * What the write path actually leaves in the database, and what happens when
 * two writers arrive together.
 *
 * <p>Written because the unit tests around {@code BookingCommandService} mock the
 * repository, so they can only assert that {@code save} was called — which
 * says nothing about whether the row changed, and nothing at all about the
 * V30 optimistic lock, whose whole behaviour happens at flush time against a
 * real database. Three things here were previously defended by a comment:
 * that the lock produces a loser rather than a silent overwrite, that the
 * flush in {@code replaceResources} is load-bearing, and that a status change
 * is persisted.
 */
class BookingConcurrencyIT extends IntegrationTestBase {

    @Autowired private BookingCommandService commandService;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private BookingResourceRepository bookingResourceRepository;
    @Autowired private StudioResourceRepository studioResourceRepository;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PlatformTransactionManager txManager;

    private static final LocalDate EVENT_DATE = LocalDate.now().plusDays(60);
    private static final String IP = "203.0.113.11";

    // ── the optimistic lock ──────────────────────────────────────────────────

    /**
     * A writer that decided from a stale read cannot land.
     *
     * <p>Written as an explicit stale write rather than as two racing threads,
     * because two threads through the service are not guaranteed to overlap:
     * if the first commits before the second reads, the second sees the new
     * status, {@code CONFIRMED -> CANCELLED} is a legal transition, and both
     * succeed — a green test that proved nothing and would go red on a slow
     * machine. This reproduces the interleaving the lock exists for, every
     * time: read the row, let someone else change it, then write what the
     * first read decided.
     */
    @Test
    void aWriteFromAStaleReadIsRefusedRatherThanOverwriting() {
        Fixture fx = createTenant();
        UUID bookingId = asUser(fx, () ->
            commandService.createBooking(request(null), IP)).id();

        // The first writer's view of the booking, taken and then held.
        Booking stale = asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager)
            .execute(status -> bookingRepository.findById(bookingId).orElseThrow()));

        // Someone else moves it in the meantime.
        asUser(fx, () -> commandService.changeStatus(bookingId, "CONFIRMED", IP));

        // The first writer now writes the decision it made against the old row.
        // Legal from the ENQUIRY this copy still believes it holds.
        stale.changeStatus(BookingStatus.CANCELLED);
        assertThatThrownBy(() -> asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager)
            .execute(status -> bookingRepository.saveAndFlush(stale))))
            .isInstanceOf(OptimisticLockingFailureException.class);

        // CONFIRMED stands. Without @Version the row would read CANCELLED here,
        // and the state machine would have validated a transition out of a
        // status the booking had already left.
        assertThat(storedStatus(fx, bookingId)).isEqualTo(BookingStatus.CONFIRMED);
    }

    /**
     * The same collision reached through the service, so the mapping to a
     * conflict is exercised end to end. Two threads may or may not overlap, so
     * the assertion is only that no interleaving produces a mixed result: each
     * call either lands its own status or is refused outright.
     */
    @Test
    void twoTransitionsAtOnceNeverLeaveAMixedResult() throws Exception {
        Fixture fx = createTenant();
        UUID bookingId = asUser(fx, () ->
            commandService.createBooking(request(null), IP)).id();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Outcome> confirm = pool.submit(
                transition(fx, bookingId, BookingStatus.CONFIRMED));
            Future<Outcome> cancel = pool.submit(
                transition(fx, bookingId, BookingStatus.CANCELLED));

            List<Outcome> outcomes = List.of(confirm.get(), cancel.get());
            assertThat(outcomes).anyMatch(Outcome::won);

            BookingStatus stored = storedStatus(fx, bookingId);
            // Whatever happened, the stored status is one a winner asked for.
            assertThat(outcomes).filteredOn(Outcome::won)
                .anyMatch(o -> o.target() == stored);
        } finally {
            pool.shutdownNow();
        }
    }

    private record Outcome(BookingStatus target, boolean won) {
    }

    private Callable<Outcome> transition(Fixture fx, UUID bookingId, BookingStatus target) {
        return () -> {
            try {
                asUser(fx, () -> commandService.changeStatus(bookingId, target.name(), IP));
                return new Outcome(target, true);
            } catch (OptimisticLockingFailureException | ConflictException expected) {
                // Optimistic lock -> 409 CONCURRENT_MODIFICATION; an illegal
                // transition off the status the winner left -> 409 CONFLICT.
                return new Outcome(target, false);
            }
        };
    }

    // ── what a write actually leaves behind ──────────────────────────────────

    @Test
    void aStatusChangeIsPersisted() {
        Fixture fx = createTenant();
        UUID bookingId = asUser(fx, () ->
            commandService.createBooking(request(null), IP)).id();

        asUser(fx, () -> commandService.changeStatus(bookingId, "CONFIRMED", IP));

        assertThat(storedStatus(fx, bookingId)).isEqualTo(BookingStatus.CONFIRMED);
    }

    /**
     * The delete-then-insert in {@code replaceResources} re-adds a resource the
     * booking already held. Its composite primary key means the insert collides
     * with the delete this transaction has queued but not sent, unless the
     * delete is flushed first — which is what the flush there is for, and what
     * this test is for instead of the comment that used to be the only record
     * of it.
     */
    @Test
    void aResourceThatWasAlreadyLinkedSurvivesBeingSelectedAgain() {
        Fixture fx = createTenant();
        UUID roomA = createResource(fx, "Room A");
        UUID roomB = createResource(fx, "Room B");
        UUID kit = createResource(fx, "Lighting kit");

        UUID bookingId = asUser(fx, () ->
            commandService.createBooking(request(List.of(roomA, roomB)), IP)).id();

        // B is kept, A dropped, kit added — the kept one is the collision.
        BookingResponse updated = asUser(fx, () ->
            commandService.updateBooking(bookingId, update(List.of(roomB, kit)), IP));

        assertThat(updated.resourceIds()).containsExactlyInAnyOrder(roomB, kit);
        assertThat(storedResourceIds(fx, bookingId)).containsExactlyInAnyOrder(roomB, kit);
    }

    @Test
    void anEmptySelectionClearsTheLinksAndNullLeavesThemAlone() {
        Fixture fx = createTenant();
        UUID room = createResource(fx, "Room A");
        UUID bookingId = asUser(fx, () ->
            commandService.createBooking(request(List.of(room)), IP)).id();

        // null: the caller is not editing the links.
        asUser(fx, () -> commandService.updateBooking(bookingId, update(null), IP));
        assertThat(storedResourceIds(fx, bookingId)).containsExactly(room);

        // empty: the caller cleared them, which the form has no other way to say.
        asUser(fx, () -> commandService.updateBooking(bookingId, update(List.of()), IP));
        assertThat(storedResourceIds(fx, bookingId)).isEmpty();
    }

    @Test
    void theSameResourceTwiceIsStoredOnce() {
        Fixture fx = createTenant();
        UUID room = createResource(fx, "Room A");

        UUID bookingId = asUser(fx, () ->
            commandService.createBooking(request(List.of(room, room)), IP)).id();

        assertThat(storedResourceIds(fx, bookingId)).containsExactly(room);
    }

    // ── fixtures ─────────────────────────────────────────────────────────────

    private record Fixture(UUID tenantId, UUID userId) {
    }

    private BookingStatus storedStatus(Fixture fx, UUID bookingId) {
        return asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager).execute(status ->
            bookingRepository.findById(bookingId).map(Booking::getStatus).orElseThrow()));
    }

    private List<UUID> storedResourceIds(Fixture fx, UUID bookingId) {
        return asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager).execute(status ->
            bookingResourceRepository.findByBookingId(bookingId).stream()
                .map(com.photographplatform.api.resource.domain.BookingResource::getResourceId)
                .toList()));
    }

    private CreateBookingRequest request(List<UUID> resourceIds) {
        return new CreateBookingRequest(
            "Maria Kellner", "maria@example.test", EVENT_DATE,
            null, "WEDDING", "Berlin", null, null, 50_000, null, null, null, resourceIds);
    }

    private UpdateBookingRequest update(List<UUID> resourceIds) {
        return new UpdateBookingRequest(
            "Maria Kellner", "maria@example.test", EVENT_DATE,
            null, "WEDDING", "Berlin", null, 50_000, null, null, null, resourceIds);
    }

    private Fixture createTenant() {
        UUID tenantId = new TransactionTemplate(txManager).execute(status -> tenantRepository.save(
            new Tenant("concurrency-test-" + UUID.randomUUID(),
                "owner-" + UUID.randomUUID() + "@example.test")).getId());
        UUID userId = asTenant(tenantId, () -> new TransactionTemplate(txManager).execute(status -> {
            User staff = new User(tenantId, "photographer-" + UUID.randomUUID() + "@example.test",
                "hash", "Anna");
            staff.setStaffRole(StaffRole.OWNER);
            return userRepository.save(staff).getId();
        }));
        return new Fixture(tenantId, userId);
    }

    private UUID createResource(Fixture fx, String name) {
        return asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager).execute(status ->
            studioResourceRepository.save(
                new StudioResource(fx.tenantId(), name, "ROOM")).getId()));
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
