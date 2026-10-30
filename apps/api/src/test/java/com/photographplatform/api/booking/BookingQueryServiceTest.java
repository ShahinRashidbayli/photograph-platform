package com.photographplatform.api.booking;

import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingMapper;
import com.photographplatform.api.booking.service.BookingPaymentStateResolver;
import com.photographplatform.api.booking.service.BookingQueryService;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.resource.repository.BookingResourceRepository;
import com.photographplatform.api.resource.repository.StudioResourceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * What the read path refuses before it reaches the database.
 *
 * <p>Both of these used to be answered with an empty list, which is the same
 * response as "you have none" — so a typo in a query string looked like a fact
 * about the studio's data, and an unbounded page size looked like nothing at
 * all until it pulled a whole tenant into one response.
 */
class BookingQueryServiceTest {

    private BookingRepository bookingRepository;
    private BookingQueryService queryService;

    @BeforeEach
    void setUp() {
        bookingRepository = mock(BookingRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        BookingResourceRepository bookingResourceRepository = mock(BookingResourceRepository.class);
        BookingPaymentStateResolver paymentStateResolver = mock(BookingPaymentStateResolver.class);
        queryService = new BookingQueryService(
            bookingRepository, mock(StudioResourceRepository.class), userRepository,
            paymentStateResolver,
            new BookingMapper(userRepository, bookingResourceRepository, paymentStateResolver));
    }

    @Test
    void aStatusFilterThatIsNotAStatusIsRefused() {
        assertThatThrownBy(() -> queryService.listForPhotographer("CONFIRMEDD", 0, 20))
            .isInstanceOf(ConflictException.class);
        verifyNoInteractions(bookingRepository);
    }

    @Test
    void aPageSizeNoClientAsksForIsRefused() {
        assertThatThrownBy(() -> queryService.listForPhotographer(null, 0, 100_000))
            .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(bookingRepository);
    }
}
