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
    }

    @Test
    void allowsForwardLifecycleTransitions() {
        BookingStatus.ENQUIRY.assertCanTransitionTo(BookingStatus.CONFIRMED);
        BookingStatus.CONFIRMED.assertCanTransitionTo(BookingStatus.DEPOSIT_PAID);
        BookingStatus.DEPOSIT_PAID.assertCanTransitionTo(BookingStatus.FULLY_PAID);
        BookingStatus.FULLY_PAID.assertCanTransitionTo(BookingStatus.COMPLETED);
    }

    @Test
    void allowsCancellationFromAnyOpenState() {
        BookingStatus.ENQUIRY.assertCanTransitionTo(BookingStatus.CANCELLED);
        BookingStatus.CONFIRMED.assertCanTransitionTo(BookingStatus.CANCELLED);
        BookingStatus.DEPOSIT_PAID.assertCanTransitionTo(BookingStatus.CANCELLED);
        BookingStatus.FULLY_PAID.assertCanTransitionTo(BookingStatus.CANCELLED);
    }

    @Test
    void rejectsSkippingStates() {
        assertThatThrownBy(() -> BookingStatus.ENQUIRY.assertCanTransitionTo(BookingStatus.COMPLETED))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("Illegal");
        assertThatThrownBy(() -> BookingStatus.CONFIRMED.assertCanTransitionTo(BookingStatus.COMPLETED))
            .isInstanceOf(ConflictException.class);
    }

    @Test
    void rejectsReopeningTerminalStates() {
        assertThatThrownBy(() -> BookingStatus.COMPLETED.assertCanTransitionTo(BookingStatus.CONFIRMED))
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
}
