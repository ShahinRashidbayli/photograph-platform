package com.photographplatform.api.gallery;

import com.photographplatform.api.gallery.service.WatermarkRenderer;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The watermark's job is to be un-croppable and to actually appear. Both are
 * asserted here against a flat white source, where any non-white pixel is the
 * mark and nothing else.
 */
class WatermarkRendererTest {

    private final WatermarkRenderer renderer = new WatermarkRenderer();

    /** JPEG is lossy, so "still white" needs a tolerance rather than == 255. */
    private static final int WHITE_THRESHOLD = 245;

    @Test
    void drawsTheMarkOntoTheImage() throws IOException {
        BufferedImage result = render(white(1200, 800), "Anna Fischer Fotografie");

        assertThat(darkPixelRatio(result, 0, 0, result.getWidth(), result.getHeight()))
            .as("some pixels must be darkened by the mark")
            .isGreaterThan(0.0);
    }

    /**
     * The reason the mark is tiled and diagonal: a client who crops a corner
     * off must not end up with a clean image. Every quadrant carries part of
     * the mark, so no single crop removes it.
     */
    @Test
    void marksEveryQuadrantSoItCannotBeCroppedOut() throws IOException {
        BufferedImage result = render(white(1200, 800), "Fotolio");
        int halfW = result.getWidth() / 2;
        int halfH = result.getHeight() / 2;

        assertThat(darkPixelRatio(result, 0, 0, halfW, halfH)).as("top-left").isGreaterThan(0.0);
        assertThat(darkPixelRatio(result, halfW, 0, halfW, halfH)).as("top-right").isGreaterThan(0.0);
        assertThat(darkPixelRatio(result, 0, halfH, halfW, halfH)).as("bottom-left").isGreaterThan(0.0);
        assertThat(darkPixelRatio(result, halfW, halfH, halfW, halfH))
            .as("bottom-right").isGreaterThan(0.0);
    }

    /** Restrained enough that the client can still judge the photo. */
    @Test
    void leavesMostOfThePhotoVisible() throws IOException {
        BufferedImage result = render(white(1200, 800), "Anna Fischer Fotografie");

        assertThat(darkPixelRatio(result, 0, 0, result.getWidth(), result.getHeight()))
            .as("a proof the client cannot look at is a proof they cannot approve")
            .isLessThan(0.35);
    }

    @Test
    void capsTheLongestEdgeSoLargeUploadsDoNotExhaustHeap() throws IOException {
        BufferedImage result = render(white(6000, 4000), "Fotolio");

        assertThat(Math.max(result.getWidth(), result.getHeight())).isEqualTo(2400);
        assertThat(result.getWidth()).isEqualTo(2400);
        assertThat(result.getHeight()).isEqualTo(1600);
    }

    @Test
    void doesNotUpscaleImagesBelowTheCap() throws IOException {
        BufferedImage result = render(white(800, 600), "Fotolio");

        assertThat(result.getWidth()).isEqualTo(800);
        assertThat(result.getHeight()).isEqualTo(600);
    }

    /**
     * A tenant that never filled in a business name must not get the word
     * "null" tiled across their client's wedding photos.
     */
    @Test
    void fallsBackToAGenericMarkWhenTheLabelIsMissing() throws IOException {
        for (String label : new String[] {null, "", "   "}) {
            BufferedImage result = render(white(1000, 700), label);
            assertThat(darkPixelRatio(result, 0, 0, result.getWidth(), result.getHeight()))
                .as("label=%s still produces a mark", label)
                .isGreaterThan(0.0);
        }
    }

    @Test
    void handlesImagesWithAnAlphaChannelWithoutDarkeningThem() throws IOException {
        BufferedImage argb = new BufferedImage(600, 400, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = argb.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, 600, 400);
        g.dispose();

        BufferedImage result = render(argb, "Fotolio");

        // A PNG composited onto the default black canvas would come back mostly
        // black; the source must be drawn opaquely first.
        assertThat(darkPixelRatio(result, 0, 0, result.getWidth(), result.getHeight()))
            .isLessThan(0.35);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private BufferedImage render(BufferedImage source, String label) throws IOException {
        byte[] jpeg = renderer.render(source, label);
        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(jpeg));
        assertThat(decoded).as("output must be a decodable JPEG").isNotNull();
        return decoded;
    }

    private static BufferedImage white(int width, int height) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, width, height);
        g.dispose();
        return image;
    }

    /** Fraction of pixels in the region that are no longer white. */
    private static double darkPixelRatio(BufferedImage image, int x0, int y0, int w, int h) {
        long marked = 0;
        long total = 0;
        for (int y = y0; y < y0 + h; y++) {
            for (int x = x0; x < x0 + w; x++) {
                int rgb = image.getRGB(x, y);
                int r = (rgb >> 16) & 0xFF;
                int g = (rgb >> 8) & 0xFF;
                int b = rgb & 0xFF;
                if (r < WHITE_THRESHOLD || g < WHITE_THRESHOLD || b < WHITE_THRESHOLD) {
                    marked++;
                }
                total++;
            }
        }
        return total == 0 ? 0.0 : (double) marked / total;
    }
}
