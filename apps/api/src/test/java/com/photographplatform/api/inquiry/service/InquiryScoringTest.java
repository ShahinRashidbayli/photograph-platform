package com.photographplatform.api.inquiry.service;

import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the rule from roadmap §4.5.3 step 6: HIGH requires budget ≥ €500 AND the
 * date more than 60 days out AND a wedding. Every one of those three conditions
 * is load-bearing, so each gets a test that removes exactly one of them.
 *
 * <p>Dates are fixed, not derived from {@code LocalDate.now()}. They used to be
 * — which meant the test computed its input from the same clock the
 * implementation read, so the "more than 60 days out" boundary was never
 * actually located: any off-by-one in the day count moved both sides together
 * and the assertion passed regardless.
 */
class InquiryScoringTest {

    /** Arbitrary but fixed, so "90 days out" means the same thing every run. */
    private static final LocalDate TODAY = LocalDate.of(2026, 3, 1);

    private static final LocalDate FAR_FUTURE = TODAY.plusDays(90);
    private static final LocalDate WITHIN_60_DAYS = TODAY.plusDays(45);
    private static final LocalDate SOON = TODAY.plusDays(10);

    private static String score(String budget, String type, LocalDate date) {
        return InquiryRequestService.calculateScore(budget, type, date, TODAY);
    }

    @Test
    @DisplayName("wedding + big budget + >60 days out is the only path to HIGH")
    void allThreeConditionsMetScoresHigh() {
        assertThat(score("500_1000", "HOCHZEIT", FAR_FUTURE)).isEqualTo("HIGH");
        assertThat(score("1000_2000", "HOCHZEIT", FAR_FUTURE)).isEqualTo("HIGH");
        assertThat(score("OVER_2000", "HOCHZEIT", FAR_FUTURE)).isEqualTo("HIGH");
    }

    @Test
    @DisplayName("budget below €500 drops it out of HIGH")
    void smallBudgetIsNotHigh() {
        assertThat(score("UNDER_500", "HOCHZEIT", FAR_FUTURE)).isEqualTo("MED");
    }

    @Test
    @DisplayName("inside 60 days drops it out of HIGH")
    void nearDateIsNotHigh() {
        assertThat(score("OVER_2000", "HOCHZEIT", WITHIN_60_DAYS)).isEqualTo("MED");
    }

    @Test
    @DisplayName("anything but a wedding drops it out of HIGH")
    void nonWeddingIsNotHigh() {
        assertThat(score("OVER_2000", "PORTRAIT", FAR_FUTURE)).isEqualTo("MED");
        assertThat(score("OVER_2000", "ANDERES", FAR_FUTURE)).isEqualTo("MED");
    }

    @Test
    @DisplayName("small budget and a near date is LOW")
    void smallAndSoonIsLow() {
        assertThat(score("UNDER_500", "ANDERES", SOON)).isEqualTo("LOW");
        assertThat(score("UNDER_500", "PORTRAIT", SOON)).isEqualTo("LOW");
    }

    /**
     * The exact boundary, now that a fixed {@code today} makes it addressable.
     * The rule is "more than 60 days", so day 61 qualifies and day 60 does not —
     * a distinction the old relative-date test could not express.
     */
    @Test
    @DisplayName("the 60-day boundary is exclusive")
    void sixtyDayBoundaryIsExclusive() {
        assertThat(score("OVER_2000", "HOCHZEIT", TODAY.plusDays(61))).isEqualTo("HIGH");
        assertThat(score("OVER_2000", "HOCHZEIT", TODAY.plusDays(60))).isEqualTo("MED");
    }

    /** A date already gone scores lowest on time, whatever else is true. */
    @Test
    @DisplayName("a past date is not HIGH")
    void pastDateIsNotHigh() {
        assertThat(score("OVER_2000", "HOCHZEIT", TODAY.minusDays(1))).isNotEqualTo("HIGH");
    }

    @Test
    @DisplayName("a missing date falls back to the neutral time score")
    void missingDateIsHandled() {
        assertThat(score("OVER_2000", "HOCHZEIT", null)).isEqualTo("MED");
    }
}
