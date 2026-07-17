package com.photographplatform.api.common.util;

/**
 * Escapes untrusted text before it is interpolated into an HTML email body.
 *
 * <p>Every value that reaches a notification template originates with a user —
 * a lead's name comes from an unauthenticated public form, a customer's message
 * from the request modal — so interpolating it raw lets a submitter inject
 * markup (or a link) into the email the photographer opens. Escaping is the
 * whole defence: our templates are string-formatted, not rendered by an engine
 * that would escape for us.
 */
public final class HtmlEscape {

    private HtmlEscape() {
    }

    /** Null-safe: a missing value renders as the empty string, never "null". */
    public static String escape(String input) {
        if (input == null) {
            return "";
        }
        return input
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }
}
