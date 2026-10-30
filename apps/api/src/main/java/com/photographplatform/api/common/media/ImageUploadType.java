package com.photographplatform.api.common.media;

import com.photographplatform.api.common.util.Normalize;
import java.util.Map;

/**
 * The image types this platform accepts, and the file extension each one gets.
 *
 * <h2>Why a whitelist</h2>
 * Every upload here is a pre-signed PUT: the browser sends the bytes straight
 * to R2 and this application never sees them. The only thing the API decides is
 * what the {@code Content-Type} on that pre-signed URL says — and that value
 * used to be whatever the client asked for, validated as nothing more than
 * "non-blank, at most 100 characters".
 *
 * <p>That is a stored-XSS primitive. Anyone with an account could ask for
 * {@code text/html} (or {@code image/svg+xml}, which is a script container
 * wearing an image's name), upload a page, and get back a link that object
 * storage serves as executable HTML. Today those links live on R2's own host,
 * which is a different origin from the app, so the blast radius is phishing
 * rather than session theft — but the moment the bucket is put behind a
 * {@code *.fotolio.de} custom domain, the auth cookies are scoped to that
 * parent domain and it becomes account takeover. The fix belongs here, not in a
 * future note about how to configure the CDN safely.
 *
 * <h2>Why the extension comes from the type, not the filename</h2>
 * The object key used to end in {@code filename.substring(lastIndexOf('.'))} —
 * unbounded, unsanitised, straight from the client into the storage key. It
 * could not escape the tenant prefix (that comes first, followed by a UUID),
 * but "the attacker cannot quite reach anything with this" is a weaker property
 * than "the attacker does not shape the key at all". The extension is now one
 * of four constants, chosen by the resolved type.
 *
 * <h2>The octet-stream case</h2>
 * Browsers do not always know a file's type: dragging in a HEIC, or some
 * Windows/Firefox combinations with an ordinary JPEG, yields an empty
 * {@code File.type}, and the frontend was sending {@code application/octet-stream}
 * for it. Rejecting those outright would break real uploads, so a declared type
 * of "I don't know" — and only that — falls back to the filename's extension. A
 * declared type that is genuinely something else ({@code text/html} with a
 * {@code .jpg} name) is refused rather than talked out of, because a client that
 * names a type is telling us what it intends to upload.
 *
 * <h2>A note on WEBP and AVIF</h2>
 * They are accepted because photographers really do produce them, but plain
 * ImageIO cannot decode either, so {@code ThumbnailService} will log a warning
 * and leave the thumbnail null until an ImageIO plugin (TwelveMonkeys) is added.
 * That is pre-existing behaviour for any format ImageIO does not know; listing
 * them here does not make it worse, and narrowing the whitelist to JPEG/PNG
 * would reject uploads the product has never rejected.
 *
 * @param contentType the canonical MIME type to pin into the pre-signed PUT
 * @param extension   the file extension for the object key, leading dot included
 */
public record ImageUploadType(String contentType, String extension) {

    private static final String JPEG = "image/jpeg";

    /** Canonical type → extension. The only types a pre-signed PUT is ever issued for. */
    private static final Map<String, String> EXTENSION_BY_TYPE = Map.of(
        JPEG, ".jpg",
        "image/png", ".png",
        "image/webp", ".webp",
        "image/avif", ".avif");

    /**
     * Spellings clients send that mean one of the canonical types above.
     * {@code image/jpg} is not a registered MIME type but is emitted by enough
     * software to be worth accepting; it is normalised rather than passed
     * through, so the value that reaches R2 is always canonical.
     */
    private static final Map<String, String> ALIASES = Map.of(
        "image/jpg", JPEG,
        "image/pjpeg", JPEG,
        "image/x-png", "image/png");

    /** Filename extension → type, used only when the client declared no type at all. */
    private static final Map<String, String> TYPE_BY_EXTENSION = Map.of(
        ".jpg", JPEG,
        ".jpeg", JPEG,
        ".png", "image/png",
        ".webp", "image/webp",
        ".avif", "image/avif");

    /** What a client sends when it could not work out the type itself. */
    private static final String UNKNOWN = "application/octet-stream";

    /**
     * Resolves the type a pre-signed upload should be issued for.
     *
     * @param declaredContentType what the client says it is about to upload;
     *                            blank or {@code application/octet-stream} means
     *                            "unknown" and defers to {@code filename}
     * @param filename            the original filename, used only for the
     *                            unknown-type fallback; may be null
     * @throws IllegalArgumentException if the result is not an accepted image
     *                                  type — answered as 422 by
     *                                  {@code GlobalExceptionHandler}
     */
    public static ImageUploadType resolve(String declaredContentType, String filename) {
        String declared = canonicalise(declaredContentType);

        String resolved = declared == null || UNKNOWN.equals(declared)
            ? fromFilename(filename)
            : declared;

        String extension = resolved == null ? null : EXTENSION_BY_TYPE.get(resolved);
        if (extension == null) {
            throw new IllegalArgumentException(
                "Unsupported image type: " + describe(declaredContentType)
                    + ". Accepted types are JPEG, PNG, WEBP and AVIF.");
        }
        return new ImageUploadType(resolved, extension);
    }

    /**
     * Lower-cases, trims, and drops any parameters — {@code image/jpeg; charset=binary}
     * is the same type as {@code image/jpeg}, and comparing the raw header value
     * against a map would treat them as different.
     */
    private static String canonicalise(String contentType) {
        String normalized = Normalize.lower(contentType);
        if (normalized == null || normalized.isBlank()) {
            return null;
        }
        int parameterStart = normalized.indexOf(';');
        String type = (parameterStart >= 0 ? normalized.substring(0, parameterStart) : normalized).trim();
        return ALIASES.getOrDefault(type, type);
    }

    private static String fromFilename(String filename) {
        if (filename == null) {
            return null;
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0) {
            return null;
        }
        return TYPE_BY_EXTENSION.get(Normalize.lower(filename.substring(dot)));
    }

    /** Keeps the rejected value out of the response when it is blank or absurdly long. */
    private static String describe(String declaredContentType) {
        if (declaredContentType == null || declaredContentType.isBlank()) {
            return "(none)";
        }
        return declaredContentType.length() > 60
            ? declaredContentType.substring(0, 60) + "…"
            : declaredContentType;
    }
}
