package com.photographplatform.api.inquiry;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.service.BookingService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.inquiry.domain.InquiryRequest;
import com.photographplatform.api.inquiry.dto.InquiryRequestResponse;
import com.photographplatform.api.inquiry.repository.InquiryRequestRepository;
import com.photographplatform.api.inquiry.service.InquiryRequestService;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.service.EmailService;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.core.StringRedisTemplate;
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
 * rejecting must not create a booking; both notify the customer; and an
 * already-triaged inquiry is terminal (409).
 */
class InquiryTriageServiceTest {

    private static final UUID ACTOR_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID CUSTOMER_ID = UUID.randomUUID();
    private static final UUID INQUIRY_ID = UUID.randomUUID();
    private static final String IP = "203.0.113.20";

    private InquiryRequestRepository inquiryRepository;
    private BookingService bookingService;
    private EmailService emailService;
    private AuditService auditService;
    private User customer;
    private InquiryRequestService service;

    @BeforeEach
    void setUp() {
        inquiryRepository = mock(InquiryRequestRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        bookingService = mock(BookingService.class);
        emailService = mock(EmailService.class);
        auditService = mock(AuditService.class);
        TenantRepository tenantRepository = mock(TenantRepository.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);

        service = new InquiryRequestService(inquiryRepository, userRepository, tenantRepository,
            auditService, eventPublisher, redis, bookingService, emailService);

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

    @Test
    void acceptCreatesBookingAndMovesToBookingCreated() {
        InquiryRequest inquiry = pendingInquiry();
        when(inquiryRepository.findById(INQUIRY_ID)).thenReturn(Optional.of(inquiry));

        InquiryRequestResponse response = service.updateStatus(INQUIRY_ID, "ACCEPTED", IP);

        assertThat(response.status()).isEqualTo("BOOKING_CREATED");
        verify(bookingService).createFromInquiry(eq(inquiry), eq(customer), eq(IP));
        verify(emailService).send(any(EmailMessage.class));
        verify(auditService).log(
            eq("INQUIRY_ACCEPTED"), eq("INQUIRY_REQUEST"), any(), eq(TENANT_ID), eq(ACTOR_ID), eq(IP));
    }

    @Test
    void rejectDoesNotCreateBooking() {
        InquiryRequest inquiry = pendingInquiry();
        when(inquiryRepository.findById(INQUIRY_ID)).thenReturn(Optional.of(inquiry));

        InquiryRequestResponse response = service.updateStatus(INQUIRY_ID, "REJECTED", IP);

        assertThat(response.status()).isEqualTo("REJECTED");
        verify(bookingService, never()).createFromInquiry(any(), any(), any());
        verify(emailService).send(any(EmailMessage.class));
    }

    @Test
    void alreadyTriagedInquiryIsRejectedWith409() {
        InquiryRequest inquiry = pendingInquiry();
        inquiry.setStatus("BOOKING_CREATED");
        when(inquiryRepository.findById(INQUIRY_ID)).thenReturn(Optional.of(inquiry));

        assertThatThrownBy(() -> service.updateStatus(INQUIRY_ID, "ACCEPTED", IP))
            .isInstanceOf(ConflictException.class);

        verify(bookingService, never()).createFromInquiry(any(), any(), any());
    }

    @Test
    void unsupportedTargetStatusIsRejected() {
        assertThatThrownBy(() -> service.updateStatus(INQUIRY_ID, "PENDING", IP))
            .isInstanceOf(ConflictException.class);
    }
}
