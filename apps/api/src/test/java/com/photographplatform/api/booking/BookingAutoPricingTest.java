package com.photographplatform.api.booking;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingMapper;
import com.photographplatform.api.booking.service.BookingService;
import com.photographplatform.api.resource.repository.BookingResourceRepository;
import com.photographplatform.api.resource.repository.StudioResourceRepository;
import com.photographplatform.api.client.repository.ClientRepository;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.pricing.domain.Package;
import com.photographplatform.api.pricing.repository.PackageRepository;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pricing-resolution contract for the booking-create path. Three rules, in
 * priority order:
 * <ol>
 *   <li>An explicit {@code totalAmountCents} on the request always wins —
 *       photographers override packages with custom quotes / discounts and
 *       that intent must not be silently replaced.</li>
 *   <li>No explicit price + a {@code packageId} ⇒ look up the package, use
 *       its {@code price_cents}.</li>
 *   <li>An unknown {@code packageId} surfaces as 404 ({@code NotFoundException})
 *       rather than silently zero-pricing a wedding.</li>
 * </ol>
 */
class BookingAutoPricingTest {

    private static final UUID ACTOR_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();

    private BookingRepository bookingRepository;
    private ClientRepository clientRepository;
    private UserRepository userRepository;
    private AuditService auditService;
    private PackageRepository packageRepository;
    private BookingService bookingService;

    @BeforeEach
    void setUp() {
        bookingRepository = mock(BookingRepository.class);
        clientRepository = mock(ClientRepository.class);
        userRepository = mock(UserRepository.class);
        auditService = mock(AuditService.class);
        packageRepository = mock(PackageRepository.class);
        com.photographplatform.api.booking.service.BookingPaymentStateResolver paymentStateResolver =
            mock(com.photographplatform.api.booking.service.BookingPaymentStateResolver.class);
        when(paymentStateResolver.resolve(any())).thenReturn(
            new com.photographplatform.api.booking.service.BookingPaymentStateResolver.Summary(
                com.photographplatform.api.booking.domain.BookingPaymentState.NOT_INVOICED, 0, 0));

        StudioResourceRepository studioResourceRepository = mock(StudioResourceRepository.class);
        BookingResourceRepository bookingResourceRepository = mock(BookingResourceRepository.class);
        bookingService = new BookingService(
            bookingRepository, clientRepository, userRepository, auditService, packageRepository,
            paymentStateResolver, studioResourceRepository, bookingResourceRepository,
            new BookingMapper(userRepository, bookingResourceRepository, paymentStateResolver)
        );

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(ACTOR_ID.toString(), null)
        );
        User actor = mock(User.class);
        when(actor.getTenantId()).thenReturn(TENANT_ID);
        when(userRepository.findById(ACTOR_ID)).thenReturn(Optional.of(actor));

        when(bookingRepository.save(any(Booking.class)))
            .thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void explicitPriceWinsEvenWhenPackageIsLinked() {
        UUID packageId = UUID.randomUUID();
        Package pkg = new Package("Standard", 180000);
        when(packageRepository.findById(packageId)).thenReturn(Optional.of(pkg));

        CreateBookingRequest req = req(packageId, 250000); // override > package

        BookingResponse resp = bookingService.createBooking(req, "1.2.3.4");

        assertThat(resp.totalAmountCents()).isEqualTo(250000);
        // The package is still looked up, and that is deliberate rather than
        // wasted work: package_id is written either way, so this is the only
        // thing that checks the caller may write it. The comment here used to
        // claim the code was branch-free while resolvePrice returned early —
        // and the early return is exactly what let an unvalidated package_id
        // through.
        verify(packageRepository).findById(packageId);
    }

    @Test
    void unknownPackageIsRejectedEvenWhenThePriceIsExplicit() {
        // The hole this closes: with an explicit total, resolvePrice returned
        // before ever looking the package up, so package_id was persisted
        // unchecked. An id that does not exist then died at the foreign key and
        // surfaced as 409 "Resource already exists"; an id belonging to another
        // tenant satisfied the foreign key and was stored in silence. The
        // lookup is RLS-scoped, so both are now the same honest 404.
        UUID packageId = UUID.randomUUID();
        when(packageRepository.findById(packageId)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
            bookingService.createBooking(req(packageId, 250000), "1.2.3.4")
        ).isInstanceOf(NotFoundException.class);

        verify(bookingRepository, never()).save(any(Booking.class));
    }

    @Test
    void missingPriceFallsBackToPackagePrice() {
        UUID packageId = UUID.randomUUID();
        Package pkg = new Package("Standard", 180000);
        when(packageRepository.findById(packageId)).thenReturn(Optional.of(pkg));

        CreateBookingRequest req = req(packageId, null);

        BookingResponse resp = bookingService.createBooking(req, "1.2.3.4");

        ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(captor.capture());
        assertThat(captor.getValue().getTotalAmountCents()).isEqualTo(180000);
        assertThat(resp.totalAmountCents()).isEqualTo(180000);
    }

    @Test
    void missingPriceAndNoPackageStaysAtZero() {
        // A booking can legitimately be created with no package and no price
        // yet — the photographer might still be quoting. Default to 0; don't
        // surface a validation error.
        BookingResponse resp = bookingService.createBooking(req(null, null), "1.2.3.4");

        ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(captor.capture());
        assertThat(captor.getValue().getTotalAmountCents()).isZero();
        assertThat(resp.totalAmountCents()).isZero();
    }

    @Test
    void unknownPackageIdThrowsNotFound() {
        UUID packageId = UUID.randomUUID();
        when(packageRepository.findById(packageId)).thenReturn(Optional.empty());

        // Failing closed beats silently writing total=0 against a phantom
        // package_id FK — that pattern hides bugs and ships broken invoices.
        assertThatThrownBy(() ->
            bookingService.createBooking(req(packageId, null), "1.2.3.4")
        ).isInstanceOf(NotFoundException.class);
    }

    @Test
    void depositAboveTheTotalIsRejectedOnCreateNotJustOnUpdate() {
        // Regression: the deposit<=total rule was only enforced in
        // updateBooking, so a booking could be *created* with a deposit larger
        // than its total — a negative outstanding balance that the payment
        // state resolver and invoice totals both read as money owed to the
        // client. It must fail at the same place it fails on edit.
        //
        // IllegalArgumentException, which the global handler answers as 422:
        // the payload contradicts itself, no state stands in the way. This was
        // a 409 until the review — the one place in the codebase where
        // hand-rolled validation did not answer 422.
        assertThatThrownBy(() ->
            bookingService.createBooking(req(null, 100_000, 150_000), "1.2.3.4")
        ).isInstanceOf(IllegalArgumentException.class);

        verify(bookingRepository, never()).save(any(Booking.class));
    }

    @Test
    void depositEqualToTheTotalIsAccepted() {
        // The boundary is inclusive — paying the whole thing up front is a
        // normal deposit, not an overpayment.
        BookingResponse resp = bookingService.createBooking(req(null, 100_000, 100_000), "1.2.3.4");

        assertThat(resp.depositAmountCents()).isEqualTo(100_000);
        assertThat(resp.totalAmountCents()).isEqualTo(100_000);
    }

    private static CreateBookingRequest req(UUID packageId, Integer totalCents) {
        return req(packageId, totalCents, null);
    }

    private static CreateBookingRequest req(UUID packageId, Integer totalCents, Integer depositCents) {
        return new CreateBookingRequest(
            "Anna Schmidt",
            "anna@example.de",
            LocalDate.now().plusDays(120),
            null,
            "WEDDING",
            null,
            null,
            packageId,
            totalCents,
            depositCents,
            null,
            null,
            null
        );
    }
}
