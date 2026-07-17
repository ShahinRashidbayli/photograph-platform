package com.photographplatform.api.inquiry.service;

import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the rule from roadmap §4.5.3 step 6: HIGH requires budget ≥ €500 AND the
 * date more than 60 days out AND a wedding. Every one of those three conditions
 * is load-bearing, so each gets a test that removes exactly one of them.
 */
class InquiryScoringTest {

    private static final LocalDate FAR_FUTURE = LocalDate.now().plusDays(90);
    private static final LocalDate WITHIN_60_DAYS = LocalDate.now().plusDays(45);
    private static final LocalDate SOON = LocalDate.now().plusDays(10);

    private static String score(String budget, String type, LocalDate date) {
        return InquiryRequestService.calculateScore(budget, type, date);
    }

    @Test
    @DisplayName("wedding + big budget + >60 days out is the only path to HIGH")
    void allThreeConditionsMetScoresHigh() {
        assertThat(score("500_1000", "HOCHZEIT", FAR_FUTURE)).isEqualTo("HIGH");
        assertThat(score("1000_2000", "HOCHZEIT", FAR_FUTURE)).isEqualTo("HIGH");
        assertThat(score("OVER_2000", "HOCHZEIT", FAR_FUTURE)).isEqualTo("HIGH");
    }

    @Test
    @DisplayName("budget under €500 drops a wedding out of HIGH")
    void lowBudgetIsNotHigh() {
        assertThat(score("UNDER_500", "HOCHZEIT", FAR_FUTURE)).isEqualTo("MED");
    }

    @Test
    @DisplayName("a date inside 60 days drops a wedding out of HIGH")
    void shortLeadTimeIsNotHigh() {
        assertThat(score("OVER_2000", "HOCHZEIT", WITHIN_60_DAYS)).isEqualTo("MED");
    }

    @Test
    @DisplayName("a non-wedding never reaches HIGH, however rich or far out")
    void nonWeddingIsNotHigh() {
        assertThat(score("OVER_2000", "PORTRAIT", FAR_FUTURE)).isEqualTo("MED");
        assertThat(score("OVER_2000", "ANDERES", FAR_FUTURE)).isEqualTo("MED");
    }

    @Test
    @DisplayName("neither a strong budget nor a long lead time leaves LOW")
    void weakOnBothAxesScoresLow() {
        assertThat(score("UNDER_500", "ANDERES", SOON)).isEqualTo("LOW");
        assertThat(score("UNDER_500", "PORTRAIT", SOON)).isEqualTo("LOW");
    }

    @Test
    @DisplayName("either axis alone is enough for MED")
    void eitherAxisAloneScoresMed() {
        // Strong budget, imminent date.
        assertThat(score("1000_2000", "PORTRAIT", SOON)).isEqualTo("MED");
        // Weak budget, comfortable lead time.
        assertThat(score("UNDER_500", "PORTRAIT", FAR_FUTURE)).isEqualTo("MED");
    }

    /**
     * The DTO rejects past dates, so this can only be reached by a re-score of an
     * existing row whose date has since passed. It must not blow up, and it must
     * not reward the stale row.
     */
    @Test
    @DisplayName("a date in the past scores LOW rather than throwing")
    void pastDateScoresLow() {
        assertThat(score("UNDER_500", "ANDERES", LocalDate.now().minusDays(1))).isEqualTo("LOW");
    }
}
