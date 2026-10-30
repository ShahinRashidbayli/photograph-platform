package com.photographplatform.api.common.privacy;

/**
 * What erasure did to one kind of record.
 *
 * @param category    stable key for the kind of record ({@code "bookings"}, {@code "leads"}, …)
 *                    — the client translates it, so it never changes once shipped
 * @param deleted     rows removed outright
 * @param anonymized  rows kept with the person's details replaced
 * @param retained    rows left untouched because the law requires keeping them
 * @param basis       why {@code retained} rows were kept; null when none were
 */
public record ErasureOutcome(String category, int deleted, int anonymized, int retained, RetentionBasis basis) {

    public static ErasureOutcome deleted(String category, int count) {
        return new ErasureOutcome(category, count, 0, 0, null);
    }

    public static ErasureOutcome anonymized(String category, int count) {
        return new ErasureOutcome(category, 0, count, 0, null);
    }

    public static ErasureOutcome retained(String category, int count, RetentionBasis basis) {
        return new ErasureOutcome(category, 0, 0, count, count > 0 ? basis : null);
    }

    /** Whether erasure found any row of this kind at all. */
    public boolean touchedAnything() {
        return deleted + anonymized + retained > 0;
    }
}
