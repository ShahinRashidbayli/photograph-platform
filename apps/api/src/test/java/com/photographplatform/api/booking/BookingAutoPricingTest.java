package com.photographplatform.api.booking;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingService;
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

        bookingService = new BookingService(
            bookingRepository, clientRepository, userRepository, auditService, packageRepository
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
        // Package lookup is wasted work when the price is explicit; if we ever
        // optimise that away this expectation flips, but for now we accept the
        // extra read to keep the code branch-free.
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

    private static CreateBookingRequest req(UUID packageId, Integer totalCents) {
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
            null,
            null
        );
    }
}
