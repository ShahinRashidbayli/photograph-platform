package com.photographplatform.api.common.domain;

import java.util.Locale;

/**
 * The language a Customer reads, and so the language every Customer message to
 * them is written in.
 *
 * <p>Stored on leads, inquiry requests and bookings rather than on a person,
 * because the code has no single Customer record yet: a Customer exists as
 * whichever of those rows the studio holds (the {@code client} rename, #57,
 * comes later). Converting a lead or a request into a booking carries it over.
 *
 * <p>In {@code common} because lead, inquiry, booking, gallery, contract and
 * messaging all read it; any feature module as its owner would make the others
 * depend on that module for a two-value type.
 *
 * <p>Stored as the lowercase ISO 639-1 code ({@code de}, {@code en}) through
 * {@link CustomerLanguageConverter}, the same code the web app's locales use.
 */
public enum CustomerLanguage {

    DE("de"),
    EN("en");

    /** What a record entered by hand gets: the studios are German. */
    public static final CustomerLanguage DEFAULT = DE;

    private final String code;

    CustomerLanguage(String code) {
        this.code = code;
    }

    /** The ISO 639-1 code, as stored in the database. */
    public String code() {
        return code;
    }

    /**
     * Parses a stored or submitted code, case-insensitively.
     *
     * @throws IllegalArgumentException for anything but {@code de} or {@code en}
     */
    public static CustomerLanguage fromCode(String code) {
        if (code != null) {
            String normalized = code.trim().toLowerCase(Locale.ROOT);
            for (CustomerLanguage language : values()) {
                if (language.code.equals(normalized)) {
                    return language;
                }
            }
        }
        throw new IllegalArgumentException("Unknown customer language: " + code);
    }
}
