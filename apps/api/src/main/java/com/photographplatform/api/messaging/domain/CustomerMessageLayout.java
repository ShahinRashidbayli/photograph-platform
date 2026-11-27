package com.photographplatform.api.messaging.domain;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.util.HtmlEscape;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * What a Customer message looks like: a neutral shell with the studio's name at
 * the top, in the Customer's language.
 *
 * <p>Not {@code notification.email.EmailTemplate}: that one wears the Fotolio
 * wordmark and indigo, and stays for Notifications, which Fotolio sends to the
 * studio. Here the studio is the one speaking.
 *
 * <ul>
 *   <li>White-label ({@link StudioIdentity#whiteLabel()}): the studio's logo and
 *       colour, and no mention of Fotolio anywhere.</li>
 *   <li>Every other plan: slate and white, and a "Versendet über Fotolio" /
 *       "Sent via Fotolio" line at the bottom, so it is honest about who
 *       delivers it.</li>
 * </ul>
 *
 * <p>Same email-client-safe conventions as {@code EmailTemplate}: table layout,
 * inline styles, a hidden preheader, a light-only colour scheme. The block
 * helpers escape their text arguments; {@link #paragraph} takes inline HTML,
 * so a caller escapes anything it interpolates there.
 */
public final class CustomerMessageLayout {

    private static final String INK = "#0F172A";
    private static final String BODY = "#475569";
    private static final String MUTED = "#94A3B8";
    /** The button and the name colour when the studio has no colour of its own. */
    private static final String NEUTRAL_ACCENT = "#334155";
    private static final String FONT =
        "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    private CustomerMessageLayout() {
    }

    // ── content blocks ──────────────────────────────────────────────────────

    public static String heading(String text) {
        return "<h1 style=\"margin:0 0 16px;font-family:" + FONT + ";font-size:22px;line-height:1.3;"
            + "font-weight:700;color:" + INK + ";\">" + esc(text) + "</h1>";
    }

    /** Body paragraph. Accepts inline HTML: escape every interpolated value. */
    public static String paragraph(String html) {
        return "<p style=\"margin:0 0 16px;font-family:" + FONT + ";font-size:15px;line-height:1.65;"
            + "color:" + BODY + ";\">" + html + "</p>";
    }

    /** Call-to-action in the studio's colour, or neutral slate. */
    public static String button(StudioIdentity studio, String label, String href) {
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:8px 0 24px;\">"
            + "<tr><td style=\"border-radius:10px;background:" + accent(studio) + ";\">"
            + "<a href=\"" + esc(href) + "\" style=\"display:inline-block;color:#ffffff;font-family:" + FONT
            + ";font-size:15px;font-weight:600;line-height:48px;text-decoration:none;padding:0 28px;\">"
            + esc(label) + "</a></td></tr></table>";
    }

    /**
     * The photographer's {@link PersonalNote}, set apart from the fixed copy and
     * always escaped. Renders nothing for a null note.
     */
    public static String personalNote(StudioIdentity studio, PersonalNote note) {
        if (note == null) {
            return "";
        }
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\""
            + " style=\"margin:8px 0 24px;\"><tr><td style=\"border-left:3px solid " + accent(studio)
            + ";padding:4px 0 4px 16px;font-family:" + FONT + ";font-size:15px;line-height:1.65;color:" + INK
            + ";\">" + note.html() + "</td></tr></table>";
    }

    // ── document shell ──────────────────────────────────────────────────────

    /**
     * Wraps a composed body in the full document.
     *
     * @param language  the Customer's; sets {@code <html lang>} and the footer
     * @param preheader the inbox preview snippet, kept out of the visible body
     */
    public static String document(StudioIdentity studio, CustomerLanguage language, String preheader,
                                  String bodyHtml) {
        Map<String, String> values = Map.of(
            "LANG", language.code(),
            "TITLE", esc(studio.displayName()),
            "PREHEADER", esc(preheader),
            "HEADER", header(studio),
            "FOOTER", footer(studio, language),
            "BODY", bodyHtml);
        // One pass over the shell: a value is never scanned for placeholders,
        // so a studio named "{{FOOTER}}" stays a name.
        return PLACEHOLDER.matcher(SHELL)
            .replaceAll(m -> Matcher.quoteReplacement(values.get(m.group(1))));
    }

    private static String header(StudioIdentity studio) {
        StringBuilder sb = new StringBuilder();
        if (studio.logoUrl() != null) {
            sb.append("<img src=\"").append(esc(studio.logoUrl())).append("\" alt=\"")
                .append(esc(studio.displayName()))
                .append("\" height=\"48\" style=\"display:block;margin:0 auto 10px;height:48px;width:auto;\">");
        }
        if (studio.displayName() != null) {
            sb.append("<span style=\"font-family:").append(FONT)
                .append(";font-size:20px;font-weight:700;letter-spacing:-0.01em;color:")
                .append(studio.brandColor() != null ? studio.brandColor() : INK).append(";\">")
                .append(esc(studio.displayName())).append("</span>");
        }
        return sb.toString();
    }

    private static String footer(StudioIdentity studio, CustomerLanguage language) {
        if (studio.whiteLabel()) {
            return "";
        }
        String line = language == CustomerLanguage.DE ? "Versendet über Fotolio" : "Sent via Fotolio";
        return "<p style=\"margin:0;font-family:" + FONT + ";font-size:12px;line-height:1.6;color:" + MUTED
            + ";\">" + esc(line) + "</p>";
    }

    private static String accent(StudioIdentity studio) {
        return studio.brandColor() != null ? studio.brandColor() : NEUTRAL_ACCENT;
    }

    private static String esc(String value) {
        return HtmlEscape.escape(value);
    }

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(LANG|TITLE|PREHEADER|HEADER|FOOTER|BODY)}}");

    // Placeholders are filled in one pass (see document), so no value, the
    // body included, is ever read as a placeholder or a format specifier.
    private static final String SHELL = """
        <!DOCTYPE html>
        <html lang="{{LANG}}" xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="x-apple-disable-message-reformatting">
          <meta name="color-scheme" content="light">
          <meta name="supported-color-schemes" content="light">
          <title>{{TITLE}}</title>
          <style>
            :root { color-scheme:light; supported-color-schemes:light; }
            body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; }
            table { border-collapse:collapse; }
            img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
            @media only screen and (max-width:600px) {
              .cm-card { padding:28px 24px !important; }
            }
          </style>
        </head>
        <body style="margin:0;padding:0;width:100%;background-color:#F1F5F9;color-scheme:light;">
          <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F1F5F9;">
            {{PREHEADER}}
          </div>
          <div role="article" aria-roledescription="email" lang="{{LANG}}" style="background-color:#F1F5F9;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9;">
              <tr>
                <td align="center" style="padding:32px 12px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" \
        style="max-width:600px;margin:0 auto;">
                    <tr>
                      <td style="padding:4px 8px 22px;text-align:center;">{{HEADER}}</td>
                    </tr>
                    <tr>
                      <td class="cm-card" style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;padding:40px;">
                        {{BODY}}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:22px 16px 8px;text-align:center;">{{FOOTER}}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>
        </body>
        </html>
        """;
}
