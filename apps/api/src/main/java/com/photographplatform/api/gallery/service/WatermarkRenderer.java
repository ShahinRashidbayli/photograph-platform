package com.photographplatform.api.gallery.service;

import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Component;

/**
 * Draws a repeating diagonal watermark across a delivered photo.
 *
 * <p>Pure image work — no storage, no database, no tenant context — so the
 * visual result can be asserted directly in a unit test.
 *
 * <h2>Why tiled and diagonal</h2>
 * A single mark in a corner is removed with a crop, and a mark along one edge
 * is removed by cropping the other way. The point of watermarking a proof is
 * that the client cannot quietly use the file as if it were the delivered
 * work, so the mark has to cross the subject: tiled at an angle, it cannot be
 * cropped out without destroying the photo.
 *
 * <p>It is still deliberately restrained — low alpha, with a dark shadow under
 * light text so it stays legible on both a bright beach and a dark reception
 * hall. A proof a client cannot actually look at is a proof they cannot
 * approve.
 */
@Component
public class WatermarkRenderer {

    /**
     * Longest-edge cap for the watermarked derivative.
     *
     * <p>Two reasons, one product and one operational. A watermarked file is a
     * proof, not the delivery, so full sensor resolution is not the point.
     * And watermarking decodes the whole image into heap: a 45-megapixel RAW
     * export is roughly 180MB as an ARGB raster, and a handful of those
     * arriving together would exhaust the container's heap on a small
     * instance. 2400px stays sharp on any screen, including a retina display
     * at full width.
     */
    static final int MAX_EDGE_PX = 2400;

    private static final float JPEG_QUALITY = 0.88f;
    private static final double ANGLE_DEGREES = -30.0;

    /** Text height as a fraction of the image's shorter edge. */
    private static final double FONT_SCALE = 0.045;
    private static final int MIN_FONT_PX = 14;

    /** Gap between repetitions, as a multiple of the text's own size. */
    private static final double TILE_GAP_X = 1.6;
    private static final double TILE_GAP_Y = 4.0;

    private static final float TEXT_ALPHA = 0.28f;
    private static final float SHADOW_ALPHA = 0.20f;

    /**
     * Renders {@code text} over {@code source} and encodes the result as JPEG.
     *
     * @param source the decoded original; not modified
     * @param text   the mark to draw, typically the photographer's business name
     * @return JPEG bytes of the watermarked, size-capped image
     */
    public byte[] render(BufferedImage source, String text) throws IOException {
        BufferedImage scaled = capLongestEdge(source);
        BufferedImage canvas = new BufferedImage(
            scaled.getWidth(), scaled.getHeight(), BufferedImage.TYPE_INT_RGB);

        Graphics2D g = canvas.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,
                RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

            // TYPE_INT_RGB starts black; a source with an alpha channel (PNG)
            // would otherwise composite against it and darken the photo.
            g.drawImage(scaled, 0, 0, null);
            drawTiledText(g, canvas.getWidth(), canvas.getHeight(), safeText(text));
        } finally {
            g.dispose();
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Thumbnails.of(canvas)
            .scale(1.0)
            .outputFormat("jpg")
            .outputQuality(JPEG_QUALITY)
            .toOutputStream(out);
        return out.toByteArray();
    }

    private static void drawTiledText(Graphics2D g, int width, int height, String text) {
        int shorterEdge = Math.min(width, height);
        int fontSize = Math.max(MIN_FONT_PX, (int) Math.round(shorterEdge * FONT_SCALE));
        Font font = new Font(Font.SANS_SERIF, Font.BOLD, fontSize);
        g.setFont(font);

        int textWidth = g.getFontMetrics().stringWidth(text);
        int stepX = (int) Math.round(textWidth + fontSize * TILE_GAP_X);
        int stepY = (int) Math.round(fontSize * TILE_GAP_Y);

        // Rotating about the centre leaves the corners of the (unrotated)
        // image outside the tiled band, so the grid is drawn oversized and
        // clipped — every pixel ends up covered whatever the aspect ratio.
        AffineTransform original = g.getTransform();
        g.rotate(Math.toRadians(ANGLE_DEGREES), width / 2.0, height / 2.0);

        int overscan = Math.max(width, height);
        for (int y = -overscan; y < height + overscan; y += stepY) {
            // Offset alternate rows so the marks form a staggered pattern
            // rather than vertical columns a crop could slip between.
            int rowIndex = Math.floorDiv(y + overscan, stepY);
            int offsetX = (rowIndex % 2 == 0) ? 0 : stepX / 2;
            for (int x = -overscan + offsetX; x < width + overscan; x += stepX) {
                g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, SHADOW_ALPHA));
                g.setColor(Color.BLACK);
                g.drawString(text, x + 2, y + 2);

                g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, TEXT_ALPHA));
                g.setColor(Color.WHITE);
                g.drawString(text, x, y);
            }
        }
        g.setTransform(original);
    }

    private static BufferedImage capLongestEdge(BufferedImage source) throws IOException {
        int longest = Math.max(source.getWidth(), source.getHeight());
        if (longest <= MAX_EDGE_PX) {
            return source;
        }
        return Thumbnails.of(source)
            .size(MAX_EDGE_PX, MAX_EDGE_PX)
            .keepAspectRatio(true)
            .asBufferedImage();
    }

    /**
     * A tenant with no business name set would otherwise tile the word "null"
     * across a client's wedding photos.
     */
    private static String safeText(String text) {
        String trimmed = text == null ? "" : text.trim();
        return trimmed.isEmpty() ? "PROOF" : trimmed;
    }
}
