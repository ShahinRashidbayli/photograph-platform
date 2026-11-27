package com.photographplatform.api.inquiry;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.service.BookingConversionService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.inquiry.domain.InquiryRequest;
import com.photographplatform.api.inquiry.dto.InquiryRequestResponse;
import com.photographplatform.api.inquiry.repository.InquiryRequestRepository;
import com.photographplatform.api.inquiry.service.InquiryRequestService;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.inquiry.event.InquiryDecidedEvent;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import com.photographplatform.api.common.security.RateLimiter;
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
 * Unit-level verification of {@link InquiryRequestService#updateStatus} — the
 * photographer's accept/reject triage (roadmap §4.5.7). Accepting must convert
 * the inquiry into a booking in one step and land it in {@code BOOKING_CREATED};
 * rejecting must not create a booking; both publish an {@link InquiryDecidedEvent}
 * for the Customer message; a personal note travels on the event and never into
 * the audit trail; and an already-triaged inquiry is terminal (409).
 */
class InquiryTriageServiceTest {

    private static final UUID ACTOR_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID CUSTOMER_ID = UUID.randomUUID();
    private static final UUID INQUIRY_ID = UUID.randomUUID();
    private static final String IP = "203.0.113.20";

    private InquiryRequestRepository inquiryRepository;
    private BookingConversionService bookingConversionService;
    private ApplicationEventPublisher eventPublisher;
    private AuditService auditService;
    private User customer;
    private InquiryRequestService service;

    @BeforeEach
    void setUp() {
        inquiryRepository = mock(InquiryRequestRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        bookingConversionService = mock(BookingConversionService.class);
        auditService = mock(AuditService.class);
        TenantRepository tenantRepository = mock(TenantRepository.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        RateLimiter rateLimiter = mock(RateLimiter.class);

        service = new InquiryRequestService(inquiryRepository, userRepository, tenantRepository,
            auditService, eventPublisher, rateLimiter, bookingConversionService,
            java.time.Clock.systemUTC());

        customer = mock(User.class);
        when(customer.getFullName()).thenReturn("Maria Kellner");
        when(customer.getEmail()).thenReturn("maria@example.com");
        when(userRepository.findById(CUSTOMER_ID)).thenReturn(Optional.of(customer));

        when(inquiryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(ACTOR_ID.toString(), null));
        TenantContext.setTenant(TENANT_ID.toString());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    private InquiryRequest pendingInquiry() {
        return new InquiryRequest(CUSTOMER_ID, "HOCHZEIT", "1000_2000",
            LocalDate.now().plusDays(60), "Berlin", "Looking forward", "HIGH", "BIO_LINK");
    }

    private InquiryDecidedEvent publishedDecision() {
        ArgumentCaptor<InquiryDecidedEvent> event = ArgumentCaptor.forClass(InquiryDecidedEvent.class);
        verify(eventPublisher).publishEvent(event.capture());
        return event.getValue();
    }

    @Test
    void acceptCreatesBookingAndMovesToBookingCreated() {
        InquiryRequest inquiry = pendingInquiry();
        inquiry.setLanguage(CustomerLanguage.EN);
        when(inquiryRepository.findById(INQUIRY_ID)).thenReturn(Optional.of(inquiry));
        BookingResponse booking = mock(BookingResponse.class);
        UUID bookingId = UUID.randomUUID();
        when(booking.id()).thenReturn(bookingId);
        when(bookingConversionService.createFromInquiry(inquiry, customer, IP)).thenReturn(booking);

        InquiryRequestResponse response = service.updateStatus(INQUIRY_ID, "ACCEPTED", null, IP);

        assertThat(response.status()).isEqualTo("BOOKING_CREATED");
        verify(bookingConversionService).createFromInquiry(eq(inquiry), eq(customer), eq(IP));
        verify(auditService).log(
            eq("INQUIRY_ACCEPTED"), eq("INQUIRY_REQUEST"), any(), eq(TENANT_ID), eq(ACTOR_ID), eq(IP));

        InquiryDecidedEvent event = publishedDecision();
        assertThat(event.isAccepted()).isTrue();
        assertThat(event.getBookingId()).isEqualTo(bookingId);
        assertThat(event.getTenantId()).isEqualTo(TENANT_ID);
        assertThat(event.getRecipientEmail()).isEqualTo("maria@example.com");
        assertThat(event.getRecipientName()).isEqualTo("Maria Kellner");
        assertThat(event.getLanguage()).isEqualTo(CustomerLanguage.EN);
        assertThat(event.getNote()).isNull();
        assertThat(event.getSentAt()).isNotNull();
    }

    @Test
    void rejectDoesNotCreateBooking() {
        InquiryRequest inquiry = pendingInquiry();
        when(inquiryRepository.findById(INQUIRY_ID)).thenReturn(Optional.of(inquiry));

        InquiryRequestResponse response = service.updateStatus(INQUIRY_ID, "REJECTED", "  ", IP);

        assertThat(response.status()).isEqualTo("REJECTED");
        verify(bookingConversionService, never()).createFromInquiry(any(), any(), any());
        InquiryDecidedEvent event = publishedDecision();
        assertThat(event.isAccepted()).isFalse();
        assertThat(event.getBookingId()).isNull();
        assertThat(event.getLanguage()).isEqualTo(CustomerLanguage.DE);
        assertThat(event.getNote()).as("a blank note is no note").isNull();
    }

    /**
     * The note reaches the Customer through the event; the audit row says only
     * that there was one.
     */
    @Test
    void aNoteTravelsOnTheEventAndTheAuditRecordsOnlyThatOneWasSent() {
        InquiryRequest inquiry = pendingInquiry();
        when(inquiryRepository.findById(INQUIRY_ID)).thenReturn(Optional.of(inquiry));
        String note = "<b>Leider</b> sind wir an dem Tag schon gebucht.";

        service.updateStatus(INQUIRY_ID, "REJECTED", note, IP);

        assertThat(publishedDecision().getNote()).isEqualTo(note);
        ArgumentCaptor<String> oldValue = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> newValue = ArgumentCaptor.forClass(String.class);
        verify(auditService).logChange(eq("INQUIRY_REJECTED"), eq("INQUIRY_REQUEST"), any(), eq(TENANT_ID),
            eq(ACTOR_ID), eq(IP), oldValue.capture(), newValue.capture());
        assertThat(oldValue.getValue()).isNull();
        assertThat(newValue.getValue()).isEqualTo(InquiryRequestService.SENT_WITH_A_NOTE)
            .doesNotContain("Leider");
        verify(auditService, never()).log(any(), any(), any(), any(), any(), any());
    }

    @Test
    void alreadyTriagedInquiryIsRejectedWith409() {
        InquiryRequest inquiry = pendingInquiry();
        inquiry.setStatus("BOOKING_CREATED");
        when(inquiryRepository.findById(INQUIRY_ID)).thenReturn(Optional.of(inquiry));

        assertThatThrownBy(() -> service.updateStatus(INQUIRY_ID, "ACCEPTED", null, IP))
            .isInstanceOf(ConflictException.class);

        verify(bookingConversionService, never()).createFromInquiry(any(), any(), any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void unsupportedTargetStatusIsRejected() {
        assertThatThrownBy(() -> service.updateStatus(INQUIRY_ID, "PENDING", null, IP))
            .isInstanceOf(ConflictException.class);
    }
}
