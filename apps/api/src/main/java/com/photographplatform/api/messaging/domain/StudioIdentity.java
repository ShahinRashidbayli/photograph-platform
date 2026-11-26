package com.photographplatform.api.messaging.domain;

import java.util.regex.Pattern;

/**
 * Who speaks in a Customer message: the studio's name, where a reply goes, and
 * on the white-label plan its logo and colour.
 *
 * <p>Resolved once, when the message is queued, and frozen into the outbox
 * params. The worker never looks the tenant up again, so the Customer sees the
 * studio as it was when the photographer acted, and a rename or a downgrade
 * between queueing and sending changes nothing already on its way.
 *
 * @param displayName the sender name and the name at the top of the layout;
 *                    null when the studio has set neither name yet (nothing
 *                    asks for one at registration): the message then goes
 *                    under the global sender name with no name at the top,
 *                    rather than failing the write that queued it
 * @param replyTo     where the Customer's reply goes; null when the studio has
 *                    no address at all
 * @param whiteLabel  the studio pays for {@code WHITE_LABEL_BRANDING}: its own
 *                    look, and no mention of Fotolio
 * @param logoUrl     the stable public logo URL; null without white-label or
 *                    without a logo
 * @param brandColor  {@code #RRGGBB}; null without white-label or without a colour
 */
public record StudioIdentity(
    String displayName,
    String replyTo,
    boolean whiteLabel,
    String logoUrl,
    String brandColor
) {

    /*
     * The colour goes into a style attribute as a value: escaping
     * stops a tag, not "red;background:url(…)". The branding endpoint already
     * validates it, but this record is also read back from stored JSON.
     */
    private static final Pattern HEX_COLOR = Pattern.compile("#[0-9a-fA-F]{6}");

    public StudioIdentity {
        displayName = blankToNull(displayName);
        replyTo = blankToNull(replyTo);
        logoUrl = whiteLabel ? blankToNull(logoUrl) : null;
        brandColor = whiteLabel && brandColor != null && HEX_COLOR.matcher(brandColor).matches()
            ? brandColor
            : null;
    }

    /**
     * Applies the fallbacks.
     *
     * <ul>
     *   <li>Name: businessName, else legalName. Never the subdomain: it is a
     *       URL slug, and a Customer does not know the studio by it (#103).</li>
     *   <li>Reply-To: legalEmail, already public on the Impressum, else the
     *       owner's login address.</li>
     * </ul>
     */
    public static StudioIdentity resolve(String businessName, String legalName, String legalEmail,
                                         String ownerEmail, boolean whiteLabel, String logoUrl,
                                         String brandColor) {
        return new StudioIdentity(
            firstPresent(businessName, legalName),
            firstPresent(legalEmail, ownerEmail),
            whiteLabel,
            logoUrl,
            brandColor);
    }

    private static String firstPresent(String first, String second) {
        String a = blankToNull(first);
        return a != null ? a : blankToNull(second);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
