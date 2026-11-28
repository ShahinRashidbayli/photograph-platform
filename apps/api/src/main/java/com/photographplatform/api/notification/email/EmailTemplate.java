package com.photographplatform.api.notification.email;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.common.util.HtmlEscape;
import java.time.Year;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The single source of truth for what a Fotolio email looks like. Produces
 * production-grade, email-client-safe HTML — table layout, inline styles,
 * Outlook/MSO (VML) bulletproof buttons, a hidden preheader, viewport and
 * {@code color-scheme} meta — following the same conventions a Maizzle build
 * would emit, but rendered from Java so the dynamic content stays here.
 *
 * <p>Callers compose a body from the block helpers ({@link #heading},
 * {@link #paragraph}, {@link #button}, {@link #infoTable}, {@link #badge},
 * {@link #note}) and wrap it once with {@link #document}. The
 * block helpers escape plain-text arguments; the ones documented as accepting
 * inline HTML ({@code paragraph}, {@code note}) leave markup intact, so the
 * caller must escape any user-supplied value it interpolates.
 */
public final class EmailTemplate {

    // Brand tokens in one place — a rebrand is a single edit here. The indigo
    // accent mirrors the web app's primary (#6366F1 / #4F46E5).
    private static final String ACCENT = "#6366F1";
    private static final String ACCENT_DARK = "#4F46E5";
    private static final String INK = "#0F172A";      // headings
    private static final String BODY = "#475569";     // body copy (slate-600)
    private static final String MUTED = "#94A3B8";    // footer / fine print (slate-400)
    private static final String FONT =
        "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    private EmailTemplate() {
    }

    /** Colour intent for {@link #badge}. */
    public enum Tone { NEUTRAL, PRIMARY, SUCCESS, WARNING, DANGER }

    /**
     * A label/value row for {@link #infoTable}. A non-null {@code href} renders
     * the value as a link (e.g. a {@code mailto:} for an email address).
     */
    public record Row(String label, String value, String href) {
        public Row(String label, String value) {
            this(label, value, null);
        }
    }

    // ── content blocks ──────────────────────────────────────────────────────

    public static String heading(String text) {
        return "<h1 style=\"margin:0 0 16px;font-family:" + FONT + ";font-size:22px;line-height:1.3;"
            + "font-weight:700;color:" + INK + ";\">" + esc(text) + "</h1>";
    }

    /** Body paragraph. Accepts inline HTML (links, {@code <strong>}, {@code <br>}). */
    public static String paragraph(String html) {
        return "<p style=\"margin:0 0 16px;font-family:" + FONT + ";font-size:15px;line-height:1.65;"
            + "color:" + BODY + ";\">" + html + "</p>";
    }

    /** Bulletproof, MSO-safe call-to-action button. */
    public static String button(String label, String href) {
        String h = esc(href);
        String l = esc(label);
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:8px 0 24px;\">"
            + "<tr><td>"
            + "<!--[if mso]>"
            + "<v:roundrect xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:w=\"urn:schemas-microsoft-com:office:word\""
            + " href=\"" + h + "\" style=\"height:48px;v-text-anchor:middle;width:240px;\" arcsize=\"20%\""
            + " fillcolor=\"" + ACCENT + "\" stroke=\"f\">"
            + "<w:anchorlock/><center style=\"color:#ffffff;font-family:" + FONT
            + ";font-size:15px;font-weight:600;\">" + l + "</center></v:roundrect>"
            + "<![endif]-->"
            + "<!--[if !mso]><!-->"
            + "<a href=\"" + h + "\" style=\"display:inline-block;background:" + ACCENT + ";color:#ffffff;"
            + "font-family:" + FONT + ";font-size:15px;font-weight:600;line-height:48px;text-align:center;"
            + "text-decoration:none;border-radius:10px;padding:0 28px;\">" + l + "</a>"
            + "<!--<![endif]-->"
            + "</td></tr></table>";
    }

    /** Two-column label/value table for notification-style emails. */
    public static String infoTable(List<Row> rows) {
        StringBuilder sb = new StringBuilder(
            "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\""
            + " style=\"margin:4px 0 28px;border-collapse:collapse;font-family:" + FONT + ";font-size:15px;\">");
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            // Hairline separator between rows (not under the last one) gives the
            // table a clean, scannable structure instead of a wall of text.
            String border = i < rows.size() - 1 ? "border-bottom:1px solid #EEF2F6;" : "";
            String value = r.href() == null
                ? esc(r.value())
                : "<a href=\"" + esc(r.href()) + "\" style=\"color:" + ACCENT_DARK
                    + ";text-decoration:none;font-weight:600;\">" + esc(r.value()) + "</a>";
            sb.append("<tr>")
                .append("<td style=\"padding:11px 16px 11px 0;color:").append(MUTED)
                .append(";font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;")
                .append("width:120px;vertical-align:top;white-space:nowrap;").append(border).append("\">")
                .append(esc(r.label())).append("</td>")
                .append("<td style=\"padding:11px 0;color:").append(INK)
                .append(";font-weight:500;vertical-align:top;").append(border).append("\">")
                .append(value).append("</td>")
                .append("</tr>");
        }
        return sb.append("</table>").toString();
    }

    /** Small rounded status pill. */
    public static String badge(String text, Tone tone) {
        // [background, foreground] per tone.
        String[] colors = switch (tone) {
            case SUCCESS -> new String[] {"#DCFCE7", "#166534"};
            case WARNING -> new String[] {"#FEF3C7", "#92400E"};
            case DANGER -> new String[] {"#FEE2E2", "#991B1B"};
            case PRIMARY -> new String[] {"#E0E7FF", ACCENT_DARK};
            default -> new String[] {"#F1F5F9", "#334155"};
        };
        return "<span style=\"display:inline-block;margin:0 0 12px;padding:4px 12px;border-radius:999px;background:"
            + colors[0] + ";color:" + colors[1] + ";font-family:" + FONT
            + ";font-size:12px;font-weight:700;letter-spacing:.04em;\">" + esc(text) + "</span>";
    }

    /** Fine print — fallback links, IDs, "ignore this email". Accepts inline HTML. */
    public static String note(String html) {
        return "<p style=\"margin:0 0 8px;font-family:" + FONT + ";font-size:13px;line-height:1.6;color:"
            + MUTED + ";word-break:break-word;\">" + html + "</p>";
    }

    /** Bulleted list. Each item accepts inline HTML (escape dynamic parts). */
    public static String bulletList(List<String> items) {
        StringBuilder sb = new StringBuilder("<ul style=\"margin:0;padding-left:20px;font-family:" + FONT
            + ";font-size:15px;line-height:1.7;color:" + BODY + ";\">");
        for (String item : items) {
            sb.append("<li style=\"margin:0 0 6px;\">").append(item).append("</li>");
        }
        return sb.append("</ul>").toString();
    }

    /** Accent-bordered highlight box (accepts inline HTML — e.g. a small heading + a {@link #bulletList}). */
    public static String callout(String html) {
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\""
            + " style=\"margin:8px 0 24px;\"><tr><td style=\"background:#F8FAFC;border-left:4px solid "
            + ACCENT + ";border-radius:8px;padding:18px 20px;\">" + html + "</td></tr></table>";
    }

    /** Highlight box with a bold title above the body. */
    public static String callout(String title, String bodyHtml) {
        String titleHtml = "<p style=\"margin:0 0 10px;font-family:" + FONT + ";font-size:15px;"
            + "font-weight:700;color:" + INK + ";\">" + esc(title) + "</p>";
        return callout(titleHtml + bodyHtml);
    }

    // ── document shell ──────────────────────────────────────────────────────

    /**
     * "Hallo Anna," / "Hi Anna,", or a neutral "Hallo," / "Hi," when there is
     * no name to use.
     *
     * <p>A name that is an email address counts as none: some accounts carry
     * their address as the name, and "Hi kunde.anna@…" reads like a machine
     * wrote it (#126).
     */
    public static String greeting(CustomerLanguage language, String name) {
        String hello = language == CustomerLanguage.EN ? "Hi" : "Hallo";
        String person = name == null ? "" : name.strip();
        if (person.isEmpty() || person.contains("@")) {
            return paragraph(hello + ",");
        }
        return paragraph(hello + " " + esc(person) + ",");
    }

    /**
     * Wraps a composed body in the full branded, client-safe document.
     *
     * @param preheader the inbox preview snippet, kept out of the visible body
     * @param language  the reader's; sets {@code <html lang>} and the footer.
     *                  Null is {@link CustomerLanguage#DEFAULT}: a job queued
     *                  before the email had a language carries none.
     */
    public static String document(String preheader, String bodyHtml, CustomerLanguage language) {
        CustomerLanguage lang = language == null ? CustomerLanguage.DEFAULT : language;
        Map<String, String> values = Map.of(
            "LANG", lang.code(),
            "PREHEADER", esc(preheader),
            "FOOTER", lang == CustomerLanguage.EN
                ? "Sent by Fotolio because you have an account or contacted a photographer here."
                : "Von Fotolio gesendet, weil Sie hier ein Konto haben oder ein Fotostudio kontaktiert haben.",
            "YEAR", String.valueOf(Year.now().getValue()),
            "BODY", bodyHtml);
        // One pass over the shell, as in CustomerMessageLayout: a value is never
        // scanned for placeholders, so a preheader naming "{{BODY}}" stays text.
        return PLACEHOLDER.matcher(SHELL)
            .replaceAll(m -> Matcher.quoteReplacement(values.get(m.group(1))));
    }

    private static String esc(String value) {
        return value == null ? "" : HtmlEscape.escape(value);
    }

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(LANG|PREHEADER|FOOTER|YEAR|BODY)}}");

    // Placeholders are filled in one pass (see document), so the body may
    // contain any characters without format-specifier hazards.
    private static final String SHELL = """
        <!DOCTYPE html>
        <html lang="{{LANG}}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" \
        xmlns:o="urn:schemas-microsoft-com:office:office">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="x-apple-disable-message-reformatting">
          <!-- Lock to a light rendering. The card is a light design (white card,
               dark text); telling clients we only support "light" stops Apple
               Mail et al. from flipping the card dark while the inline text
               colours stay dark — which left the body unreadable. -->
          <meta name="color-scheme" content="light">
          <meta name="supported-color-schemes" content="light">
          <!--[if mso]>
          <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch>\
        </o:OfficeDocumentSettings></xml></noscript>
          <![endif]-->
          <title>Fotolio</title>
          <style>
            :root { color-scheme:light; supported-color-schemes:light; }
            body {
              margin:0; padding:0; width:100% !important;
              -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;
            }
            table { border-collapse:collapse; }
            a { color:#4F46E5; }
            img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
            @media only screen and (max-width:600px) {
              .fl-card { padding:28px 24px !important; }
              .fl-container { width:100% !important; }
            }
          </style>
        </head>
        <body style="margin:0;padding:0;width:100%;background-color:#F1F5F9;color-scheme:light;">
          <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F1F5F9;">
            {{PREHEADER}}
          </div>
          <div role="article" aria-roledescription="email" lang="{{LANG}}" class="fl-page" style="background-color:#F1F5F9;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9;">
              <tr>
                <td align="center" style="padding:32px 12px;">
                  <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="fl-container" \
        style="max-width:600px;margin:0 auto;">
                    <tr>
                      <td style="padding:4px 8px 22px;text-align:center;">
                        <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\
        font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#6366F1;">Fotolio</span>
                      </td>
                    </tr>
                    <tr>
                      <td class="fl-card" style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;padding:40px;">
                        {{BODY}}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:22px 16px 8px;text-align:center;">
                        <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\
        font-size:12px;line-height:1.6;color:#94A3B8;">
                          {{FOOTER}}
                        </p>
                        <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\
        font-size:12px;line-height:1.6;color:#CBD5E1;">
                          &copy; {{YEAR}} Fotolio
                        </p>
                      </td>
                    </tr>
                  </table>
                  <!--[if mso]></td></tr></table><![endif]-->
                </td>
              </tr>
            </table>
          </div>
        </body>
        </html>
        """;
}
