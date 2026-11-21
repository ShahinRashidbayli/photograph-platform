package com.photographplatform.api.booking.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.photographplatform.api.common.exception.ConflictException;
import org.junit.jupiter.api.Test;

class BookingStatusTest {

    @Test
    void parseAcceptsKnownValuesCaseInsensitively() {
        assertThat(BookingStatus.parse("enquiry")).isEqualTo(BookingStatus.ENQUIRY);
        assertThat(BookingStatus.parse(" CONFIRMED ")).isEqualTo(BookingStatus.CONFIRMED);
    }

    @Test
    void parseRejectsUnknownValueWithConflict() {
        assertThatThrownBy(() -> BookingStatus.parse("BOGUS"))
            .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> BookingStatus.parse(null))
            .isInstanceOf(ConflictException.class);
        // The old payment-conflated states no longer parse at all — payment
        // progress is derived (BookingPaymentState), never a lifecycle value.
        assertThatThrownBy(() -> BookingStatus.parse("DEPOSIT_PAID"))
            .isInstanceOf(ConflictException.class);
    }

    @Test
    void allowsForwardLifecycleTransitions() {
        BookingStatus.ENQUIRY.assertCanTransitionTo(BookingStatus.CONFIRMED);
        BookingStatus.CONFIRMED.assertCanTransitionTo(BookingStatus.COMPLETED);
    }

    @Test
    void allowsPostponementAndReturnToConfirmed() {
        BookingStatus.CONFIRMED.assertCanTransitionTo(BookingStatus.POSTPONED);
        BookingStatus.POSTPONED.assertCanTransitionTo(BookingStatus.CONFIRMED);
        BookingStatus.POSTPONED.assertCanTransitionTo(BookingStatus.CANCELLED);
    }

    @Test
    void allowsDecliningOnlyFromEnquiry() {
        BookingStatus.ENQUIRY.assertCanTransitionTo(BookingStatus.DECLINED);
        assertThatThrownBy(() -> BookingStatus.CONFIRMED.assertCanTransitionTo(BookingStatus.DECLINED))
            .isInstanceOf(ConflictException.class);
    }

    @Test
    void allowsCancellationFromAnyNonTerminalState() {
        BookingStatus.ENQUIRY.assertCanTransitionTo(BookingStatus.CANCELLED);
        BookingStatus.CONFIRMED.assertCanTransitionTo(BookingStatus.CANCELLED);
        BookingStatus.POSTPONED.assertCanTransitionTo(BookingStatus.CANCELLED);
        BookingStatus.COMPLETED.assertCanTransitionTo(BookingStatus.CANCELLED);
    }

    @Test
    void rejectsSkippingStates() {
        assertThatThrownBy(() -> BookingStatus.ENQUIRY.assertCanTransitionTo(BookingStatus.COMPLETED))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("Illegal");
    }

    @Test
    void rejectsReopeningTerminalStates() {
        assertThatThrownBy(() -> BookingStatus.COMPLETED.assertCanTransitionTo(BookingStatus.CONFIRMED))
            .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> BookingStatus.DECLINED.assertCanTransitionTo(BookingStatus.ENQUIRY))
            .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> BookingStatus.CANCELLED.assertCanTransitionTo(BookingStatus.ENQUIRY))
            .isInstanceOf(ConflictException.class);
    }

    @Test
    void rejectsTransitionToSameState() {
        assertThatThrownBy(() -> BookingStatus.ENQUIRY.assertCanTransitionTo(BookingStatus.ENQUIRY))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("already");
    }

    // Glossary: Billable is "will happen or has happened"; an enquiry never is.
    @Test
    void onlyConfirmedPostponedAndCompletedBookingsAreBillable() {
        assertThat(BookingStatus.BILLABLE).containsExactlyInAnyOrder(
            BookingStatus.CONFIRMED, BookingStatus.POSTPONED, BookingStatus.COMPLETED);
    }

    @Test
    void onlyCancelledAndDeclinedBookingsAreNotHappening() {
        assertThat(BookingStatus.CANCELLED.isNotHappening()).isTrue();
        assertThat(BookingStatus.DECLINED.isNotHappening()).isTrue();

        assertThat(BookingStatus.ENQUIRY.isNotHappening()).isFalse();
        assertThat(BookingStatus.CONFIRMED.isNotHappening()).isFalse();
        assertThat(BookingStatus.POSTPONED.isNotHappening()).isFalse();
        assertThat(BookingStatus.COMPLETED.isNotHappening()).isFalse();
    }
}
