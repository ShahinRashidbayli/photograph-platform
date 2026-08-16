package com.photographplatform.api.lead.domain;

import com.photographplatform.api.common.exception.ConflictException;
import java.util.Locale;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The lead lifecycle rules that used to live as scattered string comparisons
 * in {@code LeadService} and {@code LeadController}. Mirrors
 * {@code BookingStatusTest} so both halves of the funnel state machine are
 * pinned the same way.
 */
class LeadStatusTest {

    private final Locale original = Locale.getDefault();

    @AfterEach
    void restoreLocale() {
        Locale.setDefault(original);
    }

    @Test
    void newLeadCanReachEveryOtherState() {
        assertThat(LeadStatus.NEW.canTransitionTo(LeadStatus.REPLIED)).isTrue();
        assertThat(LeadStatus.NEW.canTransitionTo(LeadStatus.BOOKED)).isTrue();
        assertThat(LeadStatus.NEW.canTransitionTo(LeadStatus.REJECTED)).isTrue();
    }

    @Test
    void repliedLeadCanStillBeBookedOrRejectedButNotReopened() {
        assertThat(LeadStatus.REPLIED.canTransitionTo(LeadStatus.BOOKED)).isTrue();
        assertThat(LeadStatus.REPLIED.canTransitionTo(LeadStatus.REJECTED)).isTrue();
        assertThat(LeadStatus.REPLIED.canTransitionTo(LeadStatus.NEW)).isFalse();
    }

    @Test
    void bookedAndRejectedAreTerminal() {
        assertThat(LeadStatus.BOOKED.isTerminal()).isTrue();
        assertThat(LeadStatus.REJECTED.isTerminal()).isTrue();
        assertThat(LeadStatus.NEW.isTerminal()).isFalse();
        assertThat(LeadStatus.REPLIED.isTerminal()).isFalse();
    }

    @Test
    void aBookedLeadCannotBeRejected() {
        // The regression this enum protects: "rejecting" a converted lead
        // would leave the lead row contradicting the booking row it spawned.
        assertThatThrownBy(() -> LeadStatus.BOOKED.assertCanTransitionTo(LeadStatus.REJECTED))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("BOOKED -> REJECTED");
    }

    @Test
    void parseIsCaseInsensitiveAndLocaleIndependent() {
        Locale.setDefault(Locale.of("tr", "TR"));
        assertThat(LeadStatus.parse("replied")).isEqualTo(LeadStatus.REPLIED);
        assertThat(LeadStatus.parse(" Booked ")).isEqualTo(LeadStatus.BOOKED);
    }

    @Test
    void parseRejectsUnknownAndNullValues() {
        assertThatThrownBy(() -> LeadStatus.parse("ARCHIVED"))
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("Unknown lead status");
        assertThatThrownBy(() -> LeadStatus.parse(null))
            .isInstanceOf(ConflictException.class);
    }
}
