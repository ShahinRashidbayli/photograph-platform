package com.photographplatform.api.booking;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.StaffRole;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.dto.BookingConflictResponse;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.service.BookingService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.pricing.domain.Package;
import com.photographplatform.api.pricing.repository.PackageRepository;
import com.photographplatform.api.resource.domain.StudioResource;
import com.photographplatform.api.resource.repository.StudioResourceRepository;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.LocalDate;
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
 * The two id-validation holes on the booking write path, and the conflict
 * queries, against a real Postgres with RLS actually on.
 *
 * <p>These need a real database rather than mocks. Both holes are about what
 * the database will happily accept: a foreign key check runs outside row-level
 * security, so another tenant's package or studio resource satisfies the
 * constraint perfectly and lands in the row. Only a test connected as {@code
 * fotolio_app} with two real tenants can show that.
 */
class BookingResourceIT extends IntegrationTestBase {

    @Autowired private BookingService bookingService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StudioResourceRepository studioResourceRepository;
    @Autowired private PackageRepository packageRepository;
    @Autowired private PlatformTransactionManager txManager;

    private static final LocalDate EVENT_DATE = LocalDate.now().plusDays(45);

    // ── the resource IDOR ────────────────────────────────────────────────────

    @Test
    void aResourceFromAnotherStudioCannotBeAttachedToABooking() {
        Fixture mine = createTenant();
        Fixture theirs = createTenant();
        UUID theirStudio = createResource(theirs, "Their big studio", "ROOM");

        // V28 scopes booking_resources through the *booking's* tenant, not the
        // resource's, and the FK to studio_resources is checked outside RLS —
        // so before the tenant check this insert simply succeeded, and their
        // room showed up in my clash warnings.
        assertThatThrownBy(() -> asUser(mine, () ->
            bookingService.createBooking(request(null, null, List.of(theirStudio)), IP)))
            .isInstanceOf(NotFoundException.class);

        assertThat(countAcrossTenants("SELECT count(*) FROM booking_resources")).isZero();
    }

    @Test
    void aResourceOfMyOwnStudioIsAttachedNormally() {
        Fixture mine = createTenant();
        UUID myStudio = createResource(mine, "Studio A", "ROOM");

        BookingResponse created = asUser(mine, () ->
            bookingService.createBooking(request(null, null, List.of(myStudio)), IP));

        assertThat(created.resourceIds()).containsExactly(myStudio);
    }

    // ── the package hole ─────────────────────────────────────────────────────

    @Test
    void aPackageFromAnotherStudioIsRefusedEvenWithAnExplicitPrice() {
        Fixture mine = createTenant();
        Fixture theirs = createTenant();
        UUID theirPackage = createPackage(theirs, "Their wedding package", 180_000);

        // The explicit total is the whole point: it used to make resolvePrice
        // return before the package was ever looked up, so their package_id was
        // written into my booking without a word — the FK is satisfied, because
        // the FK does not know about tenants.
        assertThatThrownBy(() -> asUser(mine, () ->
            bookingService.createBooking(request(theirPackage, 250_000, null), IP)))
            .isInstanceOf(NotFoundException.class);

        assertThat(countAcrossTenants("SELECT count(*) FROM bookings")).isZero();
    }

    // ── the conflict queries ─────────────────────────────────────────────────

    /**
     * The exclusion parameter is now nullable, where it used to be a
     * caller-minted {@code UUID.randomUUID()} standing in for "exclude
     * nothing". Worth an integration test specifically: {@code (:excludeId IS
     * NULL OR ...)} is the kind of JPQL that compiles fine and then fails on
     * PostgreSQL because the driver cannot infer the parameter's type. Both
     * queries are otherwise untested.
     */
    @Test
    void conflictsAreFoundWithNoBookingToExclude() {
        Fixture mine = createTenant();
        UUID studio = createResource(mine, "Studio A", "ROOM");
        BookingResponse existing = asUser(mine, () ->
            bookingService.createBooking(request(null, null, List.of(studio)), IP));

        BookingConflictResponse clashes = asUser(mine, () ->
            bookingService.findConflicts(mine.userId(), EVENT_DATE, null, List.of(studio)));

        assertThat(clashes.resourceClashes()).hasSize(1);
        assertThat(clashes.resourceClashes().get(0).bookingId()).isEqualTo(existing.id());
        // The photographer half runs off the same nullable parameter.
        assertThat(clashes.conflicts()).isEmpty();
    }

    @Test
    void aBookingBeingEditedDoesNotClashWithItself() {
        Fixture mine = createTenant();
        UUID studio = createResource(mine, "Studio A", "ROOM");
        BookingResponse booking = asUser(mine, () ->
            bookingService.createBooking(request(null, null, List.of(studio)), IP));

        BookingConflictResponse clashes = asUser(mine, () ->
            bookingService.findConflicts(mine.userId(), EVENT_DATE, booking.id(), List.of(studio)));

        assertThat(clashes.resourceClashes()).isEmpty();
    }

    // ── fixtures ─────────────────────────────────────────────────────────────

    private static final String IP = "203.0.113.7";

    private record Fixture(UUID tenantId, UUID userId) {
    }

    private CreateBookingRequest request(UUID packageId, Integer totalCents, List<UUID> resourceIds) {
        return new CreateBookingRequest(
            "Maria Kellner", "maria@example.test", EVENT_DATE,
            null, "WEDDING", "Berlin", null, packageId, totalCents, null, null,
            null, resourceIds);
    }

    private Fixture createTenant() {
        UUID tenantId = new TransactionTemplate(txManager).execute(status -> tenantRepository.save(
            new Tenant("resource-test-" + UUID.randomUUID(),
                "owner-" + UUID.randomUUID() + "@example.test")).getId());
        UUID userId = asTenant(tenantId, () -> new TransactionTemplate(txManager).execute(status -> {
            User staff = new User(tenantId, "photographer-" + UUID.randomUUID() + "@example.test",
                "hash", "Anna");
            staff.setStaffRole(StaffRole.OWNER);
            return userRepository.save(staff).getId();
        }));
        return new Fixture(tenantId, userId);
    }

    private UUID createResource(Fixture fx, String name, String kind) {
        return asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager).execute(status ->
            studioResourceRepository.save(new StudioResource(fx.tenantId(), name, kind)).getId()));
    }

    private UUID createPackage(Fixture fx, String name, int priceCents) {
        return asTenant(fx.tenantId(), () -> new TransactionTemplate(txManager).execute(status -> {
            Package pkg = new Package(name, priceCents);
            pkg.setTenantId(fx.tenantId());
            return packageRepository.save(pkg).getId();
        }));
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
