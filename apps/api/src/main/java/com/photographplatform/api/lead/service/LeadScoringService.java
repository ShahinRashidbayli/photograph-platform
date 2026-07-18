package com.photographplatform.api.lead.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Service;

/**
 * Lead scoring, extracted from {@link LeadService} so that class no longer
 * mixes scoring rules with CRUD, conversion, CSV export and the activity
 * timeline. Owns both the component breakdown (the 0–100 bars in the lead
 * detail panel) and the HIGH/MED/LOW rollup that feeds filtering.
 *
 * <p>This is deliberately separate from {@code InquiryRequestService}'s scorer:
 * the two intake paths speak different enum vocabularies (leads use the English
 * {@code WEDDING}/{@code UNDER_200} set, inquiries the German-facing
 * {@code HOCHZEIT}/{@code UNDER_500} set), so a shared scorer would force one of
 * them to lie about its inputs.
 *
 * <p>Scales chosen to match the spec's qualitative bands:
 * <ul>
 *   <li><b>Budget</b>: 30 / 60 / 90 / 100 for under-€200 / €200–500 /
 *       €500–1000 / over-€1000. Steep climb at €500 mirrors the rollup's
 *       "high budget" cutoff.</li>
 *   <li><b>Type</b>: 100 wedding/engagement, 70 portrait/family/newborn,
 *       60 corporate, 50 anything else. Premium event types are the single
 *       biggest revenue lever.</li>
 *   <li><b>Time</b>: 100 (&gt;60d), 70 (30–60d), 40 (&lt;30d), 10 (past).
 *       Lead time matters because rushed bookings are riskier to plan and
 *       price.</li>
 * </ul>
 */
@Service
public class LeadScoringService {

    /** Component scores on a 0–100 scale, surfaced as breakdown bars. */
    public record ScoreBreakdown(int budget, int type, int time) {}

    public ScoreBreakdown breakdown(String budgetRange, String eventType, LocalDate eventDate) {
        int budget = switch (budgetRange == null ? "" : budgetRange) {
            case "OVER_1000" -> 100;
            case "500_1000" -> 90;
            case "200_500" -> 60;
            case "UNDER_200" -> 30;
            default -> 50;
        };
        int type = switch (eventType == null ? "" : eventType) {
            case "WEDDING", "ENGAGEMENT" -> 100;
            case "PORTRAIT", "FAMILY", "NEWBORN" -> 70;
            case "CORPORATE" -> 60;
            default -> 50;
        };
        int time;
        if (eventDate == null) {
            time = 50; // no date supplied — assume neutral
        } else {
            long days = ChronoUnit.DAYS.between(LocalDate.now(), eventDate);
            if (days < 0) {
                time = 10;
            } else if (days < 30) {
                time = 40;
            } else if (days <= 60) {
                time = 70;
            } else {
                time = 100;
            }
        }
        return new ScoreBreakdown(budget, type, time);
    }

    /**
     * HIGH/MED/LOW rollup. Kept independent of an arithmetic mean of the
     * components so the existing behaviour doesn't drift as component scoring
     * is tuned: HIGH = all three components strong; MED = budget mid-tier OR
     * date at least 30 days out; else LOW.
     */
    public String rollup(String budgetRange, String eventType, LocalDate eventDate) {
        ScoreBreakdown b = breakdown(budgetRange, eventType, eventDate);
        if (b.budget() >= 90 && b.type() == 100 && b.time() == 100) {
            return "HIGH";
        }
        if (b.budget() == 60 || b.time() >= 70) {
            return "MED";
        }
        return "LOW";
    }
}
