package com.photographplatform.api.common.util;

import java.util.Locale;

/**
 * Locale-independent normalisation of the free-text values this API keys on —
 * emails, subdomains, currency codes, status names.
 *
 * <p>Every case conversion here pins {@link Locale#ROOT}. Plain {@code
 * toLowerCase()}/{@code toUpperCase()} use the JVM's default locale, and under
 * Turkish locale rules {@code 'I'} lower-cases to the dotless {@code 'ı'}
 * (U+0131) and {@code 'i'} upper-cases to the dotted {@code 'İ'} (U+0130). On a
 * host running {@code tr_TR}, {@code "Iris@example.com"} would normalise to
 * {@code "ırıs@example.com"} — a value that matches no stored row, so
 * registration silently creates a duplicate account and login/password-reset
 * lookups fail. {@code BookingStatus#parse} already documented this trap; this
 * class is where the rest of the codebase gets the same guarantee.
 *
 * <p>Also carries the null/blank trimming that was copy-pasted across
 * {@code BookingService}, {@code LeadService} and {@code InquiryRequestService}.
 */
public final class Normalize {

    private Normalize() {
    }

    /** Trimmed, lower-cased email suitable for a uniqueness lookup. Null-safe. */
    public static String email(String value) {
        return lower(value);
    }

    /** Trimmed, lower-cased value (subdomains, tokens, status names). Null-safe. */
    public static String lower(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    /** Trimmed, upper-cased value (currency codes, enum names). Null-safe. */
    public static String upper(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    /**
     * Trims and collapses "absent" and "empty string" onto the same {@code
     * null} — an optional text column should never hold {@code ""}, since that
     * makes "never filled in" and "cleared" indistinguishable in queries.
     */
    public static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
