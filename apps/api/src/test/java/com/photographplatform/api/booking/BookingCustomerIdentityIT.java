package com.photographplatform.api.booking;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.StaffRole;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.dto.CustomerBookingResponse;
import com.photographplatform.api.booking.dto.UpdateBookingRequest;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingCommandService;
import com.photographplatform.api.booking.service.BookingQueryService;
import com.photographplatform.api.common.config.TenantContext;
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

/**
 * Who a booking belongs to, once that is an identity rather than an address.
 *
 * <p>Three services decide what a signed-in customer may see — their bookings,
 * their invoices, their payments — and until V31 all three asked whether
 * {@code client_email} matched the address on their user row. Two things
 * followed: changing your address lost you everything, and the photographer's
 * edit form could hand a booking to somebody else by writing a different
 * address into it, recorded as an ordinary BOOKING_UPDATED.
 */
class BookingCustomerIdentityIT extends IntegrationTestBase {

    @Autowired private BookingCommandService commandService;
    @Autowired private BookingQueryService queryService;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PlatformTransactionManager txManager;

    private static final LocalDate EVENT_DATE = LocalDate.now().plusDays(30);
    private static final String IP = "203.0.113.13";

    @Test
    void aBookingForAnExistingCustomerNamesThemRatherThanTheirAddress() {
        Fixture studio = createTenant();
        UUID maria = createCustomer(studio, "maria@example.test");

        UUID bookingId = asUser(studio.photographer(), studio,
            () -> commandService.createBooking(request("maria@example.test"), IP)).id();

        assertThat(storedCustomerId(studio, bookingId)).isEqualTo(maria);
    }

    /**
     * The transfer this closes: the photographer edits one field and the
     * booking — with its invoices and payments — becomes somebody else's.
     */
    @Test
    void changingTheAddressOnALinkedBookingDoesNotHandItToAnyoneElse() {
        Fixture studio = createTenant();
        UUID maria = createCustomer(studio, "maria@example.test");
        UUID jonas = createCustomer(studio, "jonas@example.test");

        UUID bookingId = asUser(studio.photographer(), studio,
            () -> commandService.createBooking(request("maria@example.test"), IP)).id();

        asUser(studio.photographer(), studio, () ->
            commandService.updateBooking(bookingId, update("jonas@example.test"), IP));

        // The address moved; the ownership did not.
        assertThat(storedCustomerId(studio, bookingId)).isEqualTo(maria);
        assertThat(bookingIdsVisibleTo(jonas, "jonas@example.test", studio)).isEmpty();
        assertThat(bookingIdsVisibleTo(maria, "maria@example.test", studio))
            .containsExactly(bookingId);
    }

    /**
     * The reason the fallback exists. A booking taken over the phone has no
     * account to name yet, and dropping the address match outright would make
     * it invisible the day its customer signs up.
     */
    @Test
    void aBookingTakenBeforeTheCustomerHadAnAccountIsStillTheirs() {
        Fixture studio = createTenant();

        UUID bookingId = asUser(studio.photographer(), studio,
            () -> commandService.createBooking(request("later@example.test"), IP)).id();
        assertThat(storedCustomerId(studio, bookingId)).isNull();

        // They sign up afterwards.
        UUID later = createCustomer(studio, "later@example.test");

        assertThat(bookingIdsVisibleTo(later, "later@example.test", studio))
            .containsExactly(bookingId);
    }

    /** And the first edit after that signup links it, so the address stops deciding. */
    @Test
    void editingAnUnlinkedBookingLinksItToWhoeverNowHoldsTheAddress() {
        Fixture studio = createTenant();
        UUID bookingId = asUser(studio.photographer(), studio,
            () -> commandService.createBooking(request("later@example.test"), IP)).id();
        UUID later = createCustomer(studio, "later@example.test");

        asUser(studio.photographer(), studio, () ->
            commandService.updateBooking(bookingId, update("later@example.test"), IP));

        assertThat(storedCustomerId(studio, bookingId)).isEqualTo(later);
    }

    @Test
    void oneCustomerNeverSeesAnother() {
        Fixture studio = createTenant();
        UUID maria = createCustomer(studio, "maria@example.test");
        createCustomer(studio, "jonas@example.test");

        UUID mariasBooking = asUser(studio.photographer(), studio,
            () -> commandService.createBooking(request("maria@example.test"), IP)).id();
        asUser(studio.photographer(), studio,
            () -> commandService.createBooking(request("jonas@example.test"), IP));

        assertThat(bookingIdsVisibleTo(maria, "maria@example.test", studio))
            .containsExactly(mariasBooking);
    }

    // ── fixtures ─────────────────────────────────────────────────────────────

    private record Fixture(UUID tenantId, UUID photographer) {
    }

    private List<UUID> bookingIdsVisibleTo(UUID userId, String email, Fixture studio) {
        return asUser(userId, studio, () -> queryService.getOwnBookings(null, 0, 20))
            .stream().map(CustomerBookingResponse::id).toList();
    }

    private UUID storedCustomerId(Fixture studio, UUID bookingId) {
        return asTenant(studio.tenantId(), () -> new TransactionTemplate(txManager).execute(s ->
            // .map(...).orElseThrow() would be indistinguishable from a
            // missing booking when the link is legitimately null.
            bookingRepository.findById(bookingId).orElseThrow().getCustomerUserId()));
    }

    private CreateBookingRequest request(String clientEmail) {
        return new CreateBookingRequest(
            "Client", clientEmail, EVENT_DATE,
            null, "WEDDING", "Berlin", null, null, 50_000, null, null, null, null);
    }

    private UpdateBookingRequest update(String clientEmail) {
        return new UpdateBookingRequest(
            "Client", clientEmail, EVENT_DATE,
            null, "WEDDING", "Berlin", null, 50_000, null, null, null, null);
    }

    private Fixture createTenant() {
        UUID tenantId = new TransactionTemplate(txManager).execute(s -> tenantRepository.save(
            new Tenant("identity-test-" + UUID.randomUUID(),
                "owner-" + UUID.randomUUID() + "@example.test")).getId());
        UUID photographer = asTenant(tenantId, () -> new TransactionTemplate(txManager).execute(s -> {
            User staff = new User(tenantId, "photographer-" + UUID.randomUUID() + "@example.test",
                "hash", "Anna");
            staff.setStaffRole(StaffRole.OWNER);
            return userRepository.save(staff).getId();
        }));
        return new Fixture(tenantId, photographer);
    }

    /** A customer: a user row with no staff role, which is what makes them one. */
    private UUID createCustomer(Fixture studio, String email) {
        return asTenant(studio.tenantId(), () -> new TransactionTemplate(txManager).execute(s ->
            userRepository.save(new User(studio.tenantId(), email, "hash", null)).getId()));
    }

    private <T> T asUser(UUID userId, Fixture studio, java.util.function.Supplier<T> action) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(userId.toString(), null));
        TenantContext.setTenant(studio.tenantId().toString());
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
