package com.photographplatform.api.lead.domain;

import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.util.Normalize;

/**
 * The HIGH/MED/LOW rollup {@code LeadScoringService} assigns to a lead.
 *
 * <p>Exists so the vocabulary is written down once. The three values were
 * string literals in {@code LeadScoringService#rollup} and nowhere else, which
 * meant {@code GET /api/leads?score=HIGHH} could not be told apart from a
 * genuine "no high-scoring leads" — the filter went straight to the repository
 * and matched nothing.
 *
 * <p>Stored as text, not {@code @Enumerated}, for the same reason {@link
 * LeadStatus} is: the column and its derived queries stay as they are, and the
 * enum is the API.
 */
public enum LeadScore {
    HIGH,
    MED,
    LOW;

    /** Case-insensitive, {@code Locale.ROOT}-pinned — see {@link Normalize}. */
    public static LeadScore parse(String value) {
        if (value == null) {
            throw new ConflictException("Lead score is required");
        }
        try {
            return LeadScore.valueOf(Normalize.upper(value));
        } catch (IllegalArgumentException ex) {
            throw new ConflictException("Unknown lead score: " + value);
        }
    }
}
