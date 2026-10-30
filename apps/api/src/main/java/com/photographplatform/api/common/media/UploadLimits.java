package com.photographplatform.api.common.media;

import java.util.Locale;

/**
 * The ceiling on a single pre-signed upload.
 *
 * <p>Separate from {@link ImageUploadType} because it answers a different
 * question — that one decides <em>what</em> may be stored, this one decides
 * <em>how much</em> — but they are always applied together, at the moment a
 * pre-signed URL is minted. Both have to happen there rather than at
 * complete-time: once the URL exists, the upload has already been authorised,
 * and anything checked afterwards is a report from the client about what it
 * chose to do.
 */
public final class UploadLimits {

    private UploadLimits() {
    }

    /**
     * Refuses a declared size that is not a real file size, or is above
     * {@code maxBytes}.
     *
     * <p>The lower bound is checked here rather than left to {@code @Positive}
     * on the request record, because not every caller arrives through bean
     * validation: the avatar presign takes its size as a query parameter, where
     * a constraint annotation would only be enforced if the controller were
     * {@code @Validated} — the kind of annotation that reads as a check and
     * silently is not one. This is the one place all three upload paths meet.
     *
     * @param declaredBytes size the client says the file is; the pre-signed URL
     *                      is then signed for exactly this many bytes, so a
     *                      client that understates it cannot upload more
     * @param maxBytes      the configured ceiling
     * @param what          named in the message, so the person who hit the limit
     *                      knows which limit they hit ("Photo", "Profile photo")
     * @throws IllegalArgumentException answered as 422 by {@code GlobalExceptionHandler}
     */
    public static long requireWithin(long declaredBytes, long maxBytes, String what) {
        if (declaredBytes <= 0) {
            throw new IllegalArgumentException(what + " size must be greater than zero.");
        }
        if (declaredBytes > maxBytes) {
            throw new IllegalArgumentException(
                what + " is too large: " + megabytes(declaredBytes)
                    + " MB. The limit is " + megabytes(maxBytes) + " MB.");
        }
        return declaredBytes;
    }

    /**
     * One decimal place — "51.2 MB" reads as a size, "53687091 bytes" does not.
     *
     * <p>{@link Locale#ROOT} for the same reason {@code Normalize} pins it: on a
     * host running a comma-decimal locale this would otherwise render "51,2".
     */
    private static String megabytes(long bytes) {
        return String.format(Locale.ROOT, "%.1f", bytes / (1024.0 * 1024.0));
    }
}
