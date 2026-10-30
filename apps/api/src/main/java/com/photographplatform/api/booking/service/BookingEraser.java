package com.photographplatform.api.booking.service;

import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.ErasureSubject;
import com.photographplatform.api.common.privacy.PersonalDataEraser;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Anonymises the subject's bookings rather than deleting them.
 *
 * <p>A booking is the studio's record of work done and money owed: its
 * invoices point at it, and the revenue figures count it. What identifies the
 * client is removed ({@link Booking#erasePersonalData()}); the date, type,
 * package, amounts and status stay. Deleting it instead would also cascade to
 * its contracts — including signed ones the studio must keep.
 *
 * <p>Identifies after the account and the directory, whose keys it matches on,
 * and before galleries and contracts, which are found through it.
 */
@Component
@Order(300)
@Transactional(propagation = Propagation.MANDATORY)
public class BookingEraser implements PersonalDataEraser {

    private final BookingRepository bookingRepository;

    public BookingEraser(BookingRepository bookingRepository) {
        this.bookingRepository = bookingRepository;
    }

    @Override
    public void identify(ErasureSubject subject) {
        subject.addBookingIds(find(subject).stream().map(Booking::getId).collect(Collectors.toSet()));
    }

    @Override
    public List<ErasureOutcome> erase(ErasureSubject subject) {
        // By id rather than by re-running the match: by now the account and
        // directory links it matched on may already be gone.
        List<Booking> bookings = bookingRepository.findAllById(subject.bookingIds());
        bookings.forEach(Booking::erasePersonalData);
        bookingRepository.saveAll(bookings);
        return List.of(ErasureOutcome.anonymized("bookings", bookings.size()));
    }

    private List<Booking> find(ErasureSubject subject) {
        return bookingRepository.findForErasure(subject.customerUserId(), subject.email(), subject.clientIds());
    }
}
