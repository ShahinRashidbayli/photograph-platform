package com.photographplatform.api.booking;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingPaymentState;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.dto.UpdateBookingRequest;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingPaymentStateResolver;
import com.photographplatform.api.booking.service.BookingMapper;
import com.photographplatform.api.booking.service.BookingCommandService;
import com.photographplatform.api.booking.service.BookingPricingResolver;
import com.photographplatform.api.booking.service.CustomerAccountResolver;
import com.photographplatform.api.resource.repository.BookingResourceRepository;
import com.photographplatform.api.resource.repository.StudioResourceRepository;
import com.photographplatform.api.client.repository.ClientRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.pricing.domain.Package;
import com.photographplatform.api.pricing.repository.PackageRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit-level verification of {@link BookingCommandService} orchestration — the two
 * write paths the photographer drives: creating a booking and advancing its
 * lifecycle. The transition rules themselves live in {@code BookingStatus} (and
 * are covered by {@code BookingStatusTest}); here we prove the service wires
 * them in — always starting in {@code ENQUIRY}, refusing illegal moves with a
 * 409, unknown ids with a 404 — and never persists on a rejected path.
 */
class BookingCommandServiceTest {

    private static final UUID ACTOR_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final String IP = "203.0.113.9";

    private BookingRepository bookingRepository;
    private ClientRepository clientRepository;
    private PackageRepository packageRepository;
    private AuditService auditService;
    private StudioResourceRepository studioResourceRepository;
    private BookingCommandService commandService;

    @BeforeEach
    void setUp() {
        bookingRepository = mock(BookingRepository.class);
        clientRepository = mock(ClientRepository.class);
        packageRepository = mock(PackageRepository.class);
        auditService = mock(AuditService.class);
        UserRepository userRepository = mock(UserRepository.class);
        BookingPaymentStateResolver paymentStateResolver = mock(BookingPaymentStateResolver.class);
        when(paymentStateResolver.resolve(any())).thenReturn(
            new BookingPaymentStateResolver.Summary(BookingPaymentState.NOT_INVOICED, 0, 0));

        studioResourceRepository = mock(StudioResourceRepository.class);
        BookingResourceRepository bookingResourceRepository = mock(BookingResourceRepository.class);
        commandService = new BookingCommandService(
            bookingRepository, clientRepository, userRepository, studioResourceRepository,
            bookingResourceRepository, new BookingPricingResolver(packageRepository),
            new CustomerAccountResolver(userRepository), auditService,
            new BookingMapper(userRepository, bookingResourceRepository, paymentStateResolver));

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(ACTOR_ID.toString(), null));
        TenantContext.setTenant(TENANT_ID.toString());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    private static CreateBookingRequest request(UUID clientId, UUID packageId, Integer totalCents) {
        return new CreateBookingRequest(
            "Maria Kellner", "Maria@Example.com", LocalDate.now().plusDays(30),
            null, "WEDDING", "Berlin", clientId, packageId, totalCents, null, "  notes  ",
            null, null);
    }

    @Test
    void createBookingStartsInEnquiryAndAudits() {
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        BookingResponse response = commandService.createBooking(request(null, null, 50_000), IP);

        assertThat(response.status()).isEqualTo("ENQUIRY");
        assertThat(response.totalAmountCents()).isEqualTo(50_000);
        // Email is normalised to lower-case on the way in.
        assertThat(response.clientEmail()).isEqualTo("maria@example.com");

        ArgumentCaptor<Booking> saved = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(BookingStatus.ENQUIRY);

        verify(auditService).log(
            eq("BOOKING_CREATED"), eq("BOOKING"), any(), eq(TENANT_ID), eq(ACTOR_ID), eq(IP));
    }

    @Test
    void createBookingRejectsUnknownClientId() {
        UUID clientId = UUID.randomUUID();
        when(clientRepository.existsById(clientId)).thenReturn(false);

        assertThatThrownBy(() -> commandService.createBooking(request(clientId, null, 1000), IP))
            .isInstanceOf(NotFoundException.class);

        verify(bookingRepository, never()).save(any());
    }

    @Test
    void createBookingFallsBackToPackagePriceWhenNoExplicitTotal() {
        UUID packageId = UUID.randomUUID();
        Package pkg = mock(Package.class);
        when(pkg.getPriceCents()).thenReturn(120_000);
        when(packageRepository.findById(packageId)).thenReturn(Optional.of(pkg));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        BookingResponse response = commandService.createBooking(request(null, packageId, null), IP);

        assertThat(response.totalAmountCents()).isEqualTo(120_000);
    }

    @Test
    void createBookingRejectsUnknownPackage() {
        UUID packageId = UUID.randomUUID();
        when(packageRepository.findById(packageId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commandService.createBooking(request(null, packageId, null), IP))
            .isInstanceOf(NotFoundException.class);

        verify(bookingRepository, never()).save(any());
    }

    @Test
    void changeStatusAdvancesThroughLegalTransition() {
        UUID id = UUID.randomUUID();
        Booking booking = new Booking("Maria", "maria@example.com", LocalDate.now().plusDays(30));
        when(bookingRepository.findByIdAndTenantId(id, TENANT_ID)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        BookingResponse response = commandService.changeStatus(id, "CONFIRMED", IP);

        assertThat(response.status()).isEqualTo("CONFIRMED");
        verify(auditService).logChange(
            eq("BOOKING_STATUS_CHANGED"), eq("BOOKING"), any(), eq(TENANT_ID), eq(ACTOR_ID), eq(IP),
            eq("ENQUIRY"), eq("CONFIRMED"));
    }

    @Test
    void changeStatusRejectsIllegalTransitionWith409() {
        UUID id = UUID.randomUUID();
        Booking booking = new Booking("Maria", "maria@example.com", LocalDate.now().plusDays(30));
        when(bookingRepository.findByIdAndTenantId(id, TENANT_ID)).thenReturn(Optional.of(booking));

        // ENQUIRY may only advance to CONFIRMED or CANCELLED — jumping to COMPLETED is illegal.
        assertThatThrownBy(() -> commandService.changeStatus(id, "COMPLETED", IP))
            .isInstanceOf(ConflictException.class);

        // The entity is untouched. This used to verify that save() was never
        // called, which only held because the service called save() explicitly
        // for the benefit of this mock; what it was really asserting is that a
        // refused transition changes nothing, and that is what it now says.
        // BookingConcurrencyIT asserts the same thing about the stored row.
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.ENQUIRY);
    }

    @Test
    void changeStatusRejectsUnknownBookingWith404() {
        UUID id = UUID.randomUUID();
        when(bookingRepository.findByIdAndTenantId(id, TENANT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commandService.changeStatus(id, "CONFIRMED", IP))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void updateRefusesAResourceFromAnotherStudio() {
        // RLS does not cover this one. V28 scopes booking_resources through the
        // *booking's* tenant, not the resource's, and a foreign key check runs
        // outside row-level security — so another studio's room could be
        // attached here and would then turn up in this tenant's clash
        // warnings. The RLS-scoped lookup is what makes a foreign id absent.
        UUID id = UUID.randomUUID();
        UUID foreignResource = UUID.randomUUID();
        Booking booking = new Booking("Maria", "maria@example.com", LocalDate.now().plusDays(30));
        booking.setTenantId(TENANT_ID);
        when(bookingRepository.findByIdAndTenantId(id, TENANT_ID)).thenReturn(Optional.of(booking));
        when(studioResourceRepository.findExistingIds(any())).thenReturn(Set.of());

        assertThatThrownBy(() -> commandService.updateBooking(id, updateRequest(List.of(foreignResource)), IP))
            .isInstanceOf(NotFoundException.class)
            .hasMessageContaining(foreignResource.toString());
    }

    @Test
    void updateRefusesABookingThatIsAlreadyClosed() {
        // Repricing or re-dating a shoot that was delivered or called off does
        // not describe anything that will happen, and on a completed booking it
        // silently disagrees with the invoice already issued against it.
        // LeadService#updateLead has refused the equivalent all along.
        UUID id = UUID.randomUUID();
        Booking booking = new Booking("Maria", "maria@example.com", LocalDate.now().plusDays(30));
        booking.setTenantId(TENANT_ID);
        booking.changeStatus(BookingStatus.CANCELLED);
        when(bookingRepository.findByIdAndTenantId(id, TENANT_ID)).thenReturn(Optional.of(booking));

        assertThatThrownBy(() -> commandService.updateBooking(id, updateRequest(null), IP))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("CANCELLED");

        // Nothing was written on the way to the refusal.
        assertThat(booking.getClientName()).isEqualTo("Maria");
    }

    private static UpdateBookingRequest updateRequest(List<UUID> resourceIds) {
        return new UpdateBookingRequest(
            "Maria Kellner", "maria@example.com", LocalDate.now().plusDays(30),
            null, "WEDDING", "Berlin", null, 50_000, null, null, null, resourceIds);
    }
}
