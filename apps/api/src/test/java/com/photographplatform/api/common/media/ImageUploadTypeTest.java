package com.photographplatform.api.common.media;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The whitelist that decides what a pre-signed PUT may be issued for.
 *
 * <p>These are the cases that matter because the value under test is not
 * cosmetic: it is pinned into the upload URL and becomes the {@code
 * Content-Type} object storage serves the bytes back with. A type that gets
 * through here is a type this platform will host and serve.
 */
class ImageUploadTypeTest {

    @Test
    void acceptedTypesGetTheirCanonicalExtension() {
        assertThat(ImageUploadType.resolve("image/jpeg", "a.jpg").extension()).isEqualTo(".jpg");
        assertThat(ImageUploadType.resolve("image/png", "a.png").extension()).isEqualTo(".png");
        assertThat(ImageUploadType.resolve("image/webp", "a.webp").extension()).isEqualTo(".webp");
        assertThat(ImageUploadType.resolve("image/avif", "a.avif").extension()).isEqualTo(".avif");
    }

    /**
     * The whole point of the class. Each of these was previously accepted and
     * signed straight through, so the bucket would serve back exactly what was
     * uploaded — a page, or a script wearing an image's MIME type.
     */
    @ParameterizedTest
    @ValueSource(strings = {
        "text/html",
        "image/svg+xml",
        "application/xhtml+xml",
        "application/javascript",
        "application/pdf",
        "text/plain",
    })
    void executableAndDocumentTypesAreRefused(String contentType) {
        assertThatThrownBy(() -> ImageUploadType.resolve(contentType, "harmless.jpg"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Unsupported image type");
    }

    /**
     * A declared type is taken at its word even when the filename disagrees.
     * Falling back to the extension here would let {@code text/html} named
     * {@code .jpg} through, which is the exact payload this guards against.
     */
    @Test
    void aDeclaredTypeIsNotOverriddenByTheFilename() {
        assertThatThrownBy(() -> ImageUploadType.resolve("text/html", "photo.jpg"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * Browsers do not always know: dragging in some files yields an empty
     * {@code File.type}, for which the frontend sends octet-stream. Those are
     * real uploads and must still work.
     */
    @Test
    void anUnknownTypeFallsBackToTheFilenameExtension() {
        assertThat(ImageUploadType.resolve("application/octet-stream", "IMG_0001.JPG").contentType())
            .isEqualTo("image/jpeg");
        assertThat(ImageUploadType.resolve("", "shot.png").contentType()).isEqualTo("image/png");
        assertThat(ImageUploadType.resolve(null, "shot.webp").contentType()).isEqualTo("image/webp");
    }

    @Test
    void anUnknownTypeWithNoUsableFilenameIsRefused() {
        assertThatThrownBy(() -> ImageUploadType.resolve("application/octet-stream", "README"))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ImageUploadType.resolve(null, null))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ImageUploadType.resolve("", "page.html"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    /** Non-standard spellings real software emits, normalised rather than refused. */
    @Test
    void knownAliasesResolveToTheCanonicalType() {
        assertThat(ImageUploadType.resolve("image/jpg", null).contentType()).isEqualTo("image/jpeg");
        assertThat(ImageUploadType.resolve("image/pjpeg", null).contentType()).isEqualTo("image/jpeg");
        assertThat(ImageUploadType.resolve("image/x-png", null).contentType()).isEqualTo("image/png");
    }

    @Test
    void matchingIgnoresCaseSurroundingSpaceAndParameters() {
        assertThat(ImageUploadType.resolve("  IMAGE/JPEG  ", null).contentType())
            .isEqualTo("image/jpeg");
        assertThat(ImageUploadType.resolve("image/jpeg; charset=binary", null).contentType())
            .isEqualTo("image/jpeg");
    }

    /**
     * The extension used to be {@code filename.substring(lastIndexOf('.'))},
     * copied unbounded into the storage key. It is now one of four constants.
     */
    @Test
    void theExtensionNeverComesFromAnAcceptedTypesFilename() {
        ImageUploadType resolved =
            ImageUploadType.resolve("image/jpeg", "holiday.jpg/../../elsewhere/x.jpg");

        assertThat(resolved.extension()).isEqualTo(".jpg");
    }

    /** A long rejected value must not be echoed back into the error message wholesale. */
    @Test
    void theRejectionMessageDoesNotEchoAnUnboundedValue() {
        String absurd = "text/" + "x".repeat(500);

        assertThatThrownBy(() -> ImageUploadType.resolve(absurd, null))
            .hasMessageContaining("…")
            .satisfies(e -> assertThat(e.getMessage().length()).isLessThan(200));
    }
}
