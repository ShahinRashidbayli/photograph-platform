package com.photographplatform.api.messaging.domain;

import com.photographplatform.api.common.util.HtmlEscape;
import java.util.Objects;

/**
 * The photographer's own words in a Customer message: plain text, at most
 * {@value #MAX_LENGTH} characters.
 *
 * <p>Always rendered escaped. The rest of the message is fixed copy, and a note
 * that could carry markup could pass for part of the email's design: a button
 * to somewhere else, a fake "Fotolio" line.
 *
 * <p>Lives only in the outbox params and goes with them after delivery; the
 * audit log records that a note was sent, never its text.
 */
public record PersonalNote(String text) {

    public static final int MAX_LENGTH = 1000;

    public PersonalNote {
        Objects.requireNonNull(text, "text");
        text = text.strip();
        if (text.isEmpty()) {
            throw new IllegalArgumentException("A personal note must not be empty");
        }
        if (text.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("A personal note is at most " + MAX_LENGTH + " characters");
        }
    }

    /** The note the photographer typed, or null when they left the field empty. */
    public static PersonalNote ofNullable(String text) {
        return text == null || text.isBlank() ? null : new PersonalNote(text);
    }

    /** Escaped, with the photographer's line breaks kept. */
    public String html() {
        return HtmlEscape.escape(text).replace("\r\n", "\n").replace("\n", "<br>");
    }
}
