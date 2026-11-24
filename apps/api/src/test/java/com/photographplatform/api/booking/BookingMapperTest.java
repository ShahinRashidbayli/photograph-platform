package com.photographplatform.api.booking;

import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingPaymentState;
import com.photographplatform.api.booking.domain.BookingPricing;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.booking.service.BookingMapper;
import com.photographplatform.api.booking.service.BookingMapper.PageLookups;
import com.photographplatform.api.invoice.domain.BookingSettlement;
import com.photographplatform.api.invoice.service.Settlement;
import com.photographplatform.api.resource.repository.BookingResourceRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * The open balance a booking response carries: what is still to come in on
 * the quote.
 *
 * <p>Derived here because only Billable bookings are owed money (GLOSSARY.md),
 * and booking owns that set. Web used to work it out from its own copy of the
 * Billable statuses.
 */
class BookingMapperTest {

    private final BookingMapper mapper = new BookingMapper(
        mock(UserRepository.class), mock(BookingResourceRepository.class), mock(Settlement.class));

    @Test
    void aBillableBookingStillAsksForItsQuoteLessWhatWasPaid() {
        assertThat(openBalance(120_000, 45_000, BookingStatus.CONFIRMED)).isEqualTo(75_000);
        assertThat(openBalance(120_000, 0, BookingStatus.CONFIRMED, BookingStatus.POSTPONED)).isEqualTo(120_000);
        assertThat(openBalance(120_000, 120_000, BookingStatus.CONFIRMED, BookingStatus.COMPLETED)).isZero();
    }

    /** Nothing is agreed on an enquiry, and nothing is owed on a shoot that will not happen. */
    @Test
    void anEnquiryOrABookingThatIsNotHappeningIsOwedNothing() {
        assertThat(openBalance(120_000, 0)).isZero();
        assertThat(openBalance(120_000, 0, BookingStatus.CANCELLED)).isZero();
        assertThat(openBalance(120_000, 0, BookingStatus.DECLINED)).isZero();
    }

    /** Money beyond the quote is the studio holding the Customer's money, not a negative debt. */
    @Test
    void paidBeyondTheQuoteIsNotANegativeBalance() {
        assertThat(openBalance(120_000, 150_000, BookingStatus.CONFIRMED)).isZero();
    }

    /** @param path the status changes from ENQUIRY, in order */
    private int openBalance(int quotedCents, int paidCents, BookingStatus... path) {
        UUID id = UUID.randomUUID();
        Booking booking = new Booking("Maria Kellner", "maria@example.test", LocalDate.of(2025, 6, 14));
        ReflectionTestUtils.setField(booking, "id", id);
        booking.applyPricing(new BookingPricing(null, quotedCents, 0));
        for (BookingStatus next : path) {
            booking.changeStatus(next);
        }
        BookingSettlement settled = new BookingSettlement(BookingPaymentState.OPEN, quotedCents, paidCents, 0);
        return mapper.toResponse(booking, new PageLookups(Map.of(id, settled), Map.of(), Map.of(id, List.of())))
            .openBalanceCents();
    }
}
