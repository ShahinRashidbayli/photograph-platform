package com.photographplatform.api.booking;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.dto.CalendarEventResponse;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.booking.service.BookingService;
import com.photographplatform.api.client.repository.ClientRepository;
import com.photographplatform.api.pricing.repository.PackageRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Calendar feed transformation. The frontend hands the array straight to
 * FullCalendar, so the shape and field semantics must stay rock-solid:
 * <ul>
 *   <li>Booking with {@code event_time} → ISO date-time start ("YYYY-MM-DDTHH:MM:SS").</li>
 *   <li>Booking without {@code event_time} → date-only start ("YYYY-MM-DD"),
 *       which FullCalendar treats as an all-day block.</li>
 *   <li>Title encodes event type when present: "ClientName — EventType".</li>
 *   <li>{@code from}/{@code to} window filter inclusive on both ends.</li>
 *   <li>Cancelled bookings are still returned so the slot stays visibly held;
 *       UI distinguishes them by colour from {@code extendedProps.status}.</li>
 * </ul>
 */
class BookingCalendarFeedTest {

    private BookingRepository bookingRepository;
    private BookingService bookingService;

    @BeforeEach
    void setUp() {
        bookingRepository = mock(BookingRepository.class);
        bookingService = new BookingService(
            bookingRepository,
            mock(ClientRepository.class),
            mock(UserRepository.class),
            mock(AuditService.class),
            mock(PackageRepository.class)
        );
    }

    @Test
    void timedBookingProducesIsoDateTimeStart() {
        Booking timed = booking("Anna", "anna@x.de",
            LocalDate.of(2026, 6, 14), LocalTime.of(14, 30),
            "WEDDING", "CONFIRMED");
        when(bookingRepository.findCalendarFeed(any(), any())).thenReturn(List.of(timed));

        List<CalendarEventResponse> feed = bookingService.getCalendarFeed(null, null);

        assertThat(feed).singleElement().satisfies(ev -> {
            assertThat(ev.start()).isEqualTo("2026-06-14T14:30");
            assertThat(ev.end()).isNull();
            assertThat(ev.title()).isEqualTo("Anna — WEDDING");
            assertThat(ev.extendedProps().status()).isEqualTo("CONFIRMED");
            assertThat(ev.extendedProps().clientEmail()).isEqualTo("anna@x.de");
        });
    }

    @Test
    void allDayBookingProducesDateOnlyStart() {
        Booking allDay = booking("Bob", "bob@x.de",
            LocalDate.of(2026, 7, 1), null, null, "ENQUIRY");
        when(bookingRepository.findCalendarFeed(any(), any())).thenReturn(List.of(allDay));

        List<CalendarEventResponse> feed = bookingService.getCalendarFeed(null, null);

        // No 'T' in the start string — FullCalendar treats this as an
        // all-day event, which matches the booking having no pinned time yet.
        assertThat(feed).singleElement().satisfies(ev -> {
            assertThat(ev.start()).isEqualTo("2026-07-01");
            assertThat(ev.title()).isEqualTo("Bob"); // no event type → no separator
        });
    }

    @Test
    void rangeBoundsArePassedThroughToTheRepositoryQuery() {
        // The inclusive-bounds *contract* is enforced by the JPQL in
        // BookingRepository.findCalendarFeed (`>= :from AND <= :to`). At the
        // unit-test boundary we verify two things: (1) the service hands the
        // caller's bounds through to the query unchanged — getting either
        // bound wrong would silently drop the day the wedding actually falls
        // on; (2) it returns exactly what the repo returns, no extra Java-side
        // filtering layered on top.
        LocalDate from = LocalDate.of(2026, 6, 1);
        LocalDate to = LocalDate.of(2026, 6, 30);

        Booking onFrom = booking("Start",  "s@x", from,                       null, null, "ENQUIRY");
        Booking middle = booking("Middle", "m@x", LocalDate.of(2026, 6, 15),  null, null, "ENQUIRY");
        Booking onTo   = booking("End",    "e@x", to,                         null, null, "ENQUIRY");
        when(bookingRepository.findCalendarFeed(from, to)).thenReturn(List.of(onFrom, middle, onTo));

        List<CalendarEventResponse> feed = bookingService.getCalendarFeed(from, to);

        assertThat(feed)
            .extracting(CalendarEventResponse::title)
            .containsExactly("Start", "Middle", "End");
    }

    @Test
    void cancelledBookingsAreIncluded() {
        // The photographer's calendar should still show the slot as held —
        // otherwise a same-day cancellation immediately makes the date look
        // bookable, which has burned people. Colour-coding happens in the UI.
        Booking ok = booking("Ok",  "o@x", LocalDate.of(2026, 6, 10), null, null, "CONFIRMED");
        Booking ko = booking("Cxld", "c@x", LocalDate.of(2026, 6, 11), null, null, "CANCELLED");
        when(bookingRepository.findCalendarFeed(any(), any())).thenReturn(List.of(ok, ko));

        List<CalendarEventResponse> feed = bookingService.getCalendarFeed(null, null);

        assertThat(feed)
            .extracting(e -> tuple(e.title(), e.extendedProps().status()))
            .containsExactlyInAnyOrder(
                tuple("Ok", "CONFIRMED"),
                tuple("Cxld", "CANCELLED")
            );
    }

    private static Booking booking(String name, String email, LocalDate date, LocalTime time,
                                   String type, String status) {
        Booking b = new Booking(name, email, date);
        b.setEventTime(time);
        b.setEventType(type);
        b.setStatus(status);
        return b;
    }
}
