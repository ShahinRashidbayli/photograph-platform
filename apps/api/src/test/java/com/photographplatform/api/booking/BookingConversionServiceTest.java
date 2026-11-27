package com.photographplatform.api.booking;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingConversionService;
import com.photographplatform.api.booking.service.BookingMapper;
import com.photographplatform.api.booking.service.BookingPricingResolver;
import com.photographplatform.api.booking.service.CustomerAccountResolver;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.inquiry.domain.InquiryRequest;
import com.photographplatform.api.invoice.domain.BookingSettlement;
import com.photographplatform.api.invoice.service.Settlement;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.dto.ConvertLeadRequest;
import com.photographplatform.api.pricing.repository.PackageRepository;
import com.photographplatform.api.resource.repository.BookingResourceRepository;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link BookingConversionService}: a lead or an accepted inquiry becoming a
 * booking. What is pinned here is what the booking inherits from its source —
 * above all the Customer's language, which every later Customer message about
 * the booking is written in. Losing it on conversion would answer a Customer
 * who wrote in English in German.
 */
class BookingConversionServiceTest {

    private static final UUID ACTOR_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final String IP = "203.0.113.9";

    private BookingRepository bookingRepository;
    private BookingConversionService conversionService;

    @BeforeEach
    void setUp() {
        bookingRepository = mock(BookingRepository.class);
        when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        UserRepository userRepository = mock(UserRepository.class);
        Settlement settlement = mock(Settlement.class);
        when(settlement.ofBooking(any())).thenReturn(BookingSettlement.none());
        BookingResourceRepository bookingResourceRepository = mock(BookingResourceRepository.class);

        conversionService = new BookingConversionService(
            bookingRepository,
            new BookingPricingResolver(mock(PackageRepository.class)),
            new CustomerAccountResolver(userRepository),
            mock(AuditService.class),
            new BookingMapper(userRepository, bookingResourceRepository, settlement));

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(ACTOR_ID.toString(), null));
        TenantContext.setTenant(TENANT_ID.toString());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void convertingALeadCarriesTheCustomersLanguageOver() {
        Lead lead = new Lead("Emma Clarke", "emma@example.com", null, LocalDate.now().plusDays(60),
            "WEDDING", "1000_2000", null, IP);
        lead.setLanguage(CustomerLanguage.EN);

        BookingResponse response = conversionService.createFromLead(
            lead, new ConvertLeadRequest(null, null, null, null, null, null), IP);

        assertThat(response.language()).isEqualTo("en");
        assertThat(savedBooking().getLanguage()).isEqualTo(CustomerLanguage.EN);
    }

    @Test
    void acceptingAnInquiryCarriesTheCustomersLanguageOver() {
        InquiryRequest inquiry = new InquiryRequest(UUID.randomUUID(), "PORTRAIT", "UNDER_500",
            LocalDate.now().plusDays(20), "Berlin", null, "LOW", "BIO_LINK");
        inquiry.setLanguage(CustomerLanguage.EN);
        User customer = new User(TENANT_ID, "emma@example.com", "hash", "Emma Clarke");

        BookingResponse response = conversionService.createFromInquiry(inquiry, customer, IP);

        assertThat(response.language()).isEqualTo("en");
        assertThat(savedBooking().getLanguage()).isEqualTo(CustomerLanguage.EN);
    }

    private Booking savedBooking() {
        ArgumentCaptor<Booking> saved = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(saved.capture());
        return saved.getValue();
    }
}
