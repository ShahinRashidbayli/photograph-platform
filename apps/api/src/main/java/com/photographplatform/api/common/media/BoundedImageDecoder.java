package com.photographplatform.api.common.media;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import net.coobird.thumbnailator.util.exif.ExifFilterUtils;
import net.coobird.thumbnailator.util.exif.ExifUtils;
import net.coobird.thumbnailator.util.exif.Orientation;

/**
 * Decodes an uploaded image with a hard ceiling on the heap it can take.
 *
 * <h2>Why not {@code ImageIO.read}</h2>
 * {@code ImageIO.read} materialises every pixel the file declares, and the
 * upload limit bounds the <em>file</em>, not the pixels. The two are unrelated:
 * a PNG of a single flat colour compresses at roughly a thousand to one, so a
 * few megabytes can declare 25 000 × 25 000 pixels — about 1.9 GB once decoded.
 * Any account, trial accounts included, could upload one and take the API down
 * for every studio on it. Honest files are a problem too: a 61 MP camera JPEG
 * is about 180 MB decoded, and a gallery upload decodes them back to back.
 *
 * <p>Every derivative built from a decode is small — a 400 px thumbnail, a
 * watermarked copy capped at 2 400 px — so full resolution is never needed.
 * This class therefore:
 * <ol>
 *   <li>reads only the header to learn the dimensions, and refuses anything
 *       above {@link #MAX_SOURCE_PIXELS} without decoding a single row;</li>
 *   <li>decodes larger-than-budget images with source subsampling, so the raster
 *       held in memory never exceeds {@link #DECODE_PIXEL_BUDGET} pixels.</li>
 * </ol>
 *
 * <p>The original dimensions are returned alongside the image, because callers
 * record them on the photo and a subsampled raster would report the wrong ones.
 *
 * <h2>EXIF orientation</h2>
 * Phones and most cameras store a portrait JPEG as landscape pixels plus an
 * EXIF {@code Orientation} tag. Browsers honour the tag, so the original looks
 * right, but ImageIO ignores it and the JPEGs we encode carry no EXIF — every
 * derivative came out sideways. The decoded image is therefore turned upright
 * here, once, for every caller, and the returned dimensions are the upright
 * ones (width and height swapped for orientations 5–8), matching what a
 * browser shows for the original.
 */
public final class BoundedImageDecoder {

    /**
     * Refused outright above this. The largest sensor shipping is about 151 MP
     * (Phase One IQ4); this leaves room for stitched panoramas while keeping a
     * deliberately inflated header from costing anything but the header read.
     */
    static final long MAX_SOURCE_PIXELS = 250_000_000L;

    /**
     * The most pixels ever materialised by one decode: 24 MP is at most 96 MB
     * at four bytes per pixel. Images above it are subsampled by the smallest
     * integer step that fits, which still leaves the longest edge above 2 449 px
     * — more than the largest derivative (2 400 px) needs. See
     * {@link #subsamplingStep}.
     */
    static final long DECODE_PIXEL_BUDGET = 24_000_000L;

    private BoundedImageDecoder() {
    }

    /** An image as decoded, plus the dimensions of the file it came from. */
    public record DecodedImage(BufferedImage image, int sourceWidth, int sourceHeight) {
    }

    /** The file declares more pixels than {@link #MAX_SOURCE_PIXELS}; nothing was decoded. */
    public static final class ImageTooLargeException extends IOException {

        private static final long serialVersionUID = 1L;

        ImageTooLargeException(int width, int height) {
            super("Image declares " + width + "x" + height + " pixels, above the "
                + MAX_SOURCE_PIXELS + "-pixel decode limit");
        }
    }

    /**
     * Decodes {@code bytes} within the limits above.
     *
     * @return the decoded image, or {@code null} when no installed reader
     *         recognises the format — the same contract as {@code ImageIO.read}
     * @throws ImageTooLargeException if the header declares too many pixels
     * @throws IOException if the file is recognised but cannot be decoded
     */
    public static DecodedImage decode(byte[] bytes) throws IOException {
        return decode(bytes, MAX_SOURCE_PIXELS, DECODE_PIXEL_BUDGET);
    }

    static DecodedImage decode(byte[] bytes, long maxSourcePixels, long pixelBudget) throws IOException {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (in == null) {
                return null;
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0) {
                    throw new IOException("Image declares invalid dimensions " + width + "x" + height);
                }
                long pixels = (long) width * height;
                if (pixels > maxSourcePixels) {
                    throw new ImageTooLargeException(width, height);
                }
                Orientation orientation = exifOrientation(reader);
                ImageReadParam param = reader.getDefaultReadParam();
                int step = subsamplingStep(pixels, pixelBudget);
                if (step > 1) {
                    param.setSourceSubsampling(step, step, 0, 0);
                }
                BufferedImage image = reader.read(0, param);
                if (orientation == null || orientation == Orientation.TOP_LEFT) {
                    return new DecodedImage(image, width, height);
                }
                BufferedImage upright = ExifFilterUtils.getFilterForOrientation(orientation).apply(image);
                return swapsDimensions(orientation)
                    ? new DecodedImage(upright, height, width)
                    : new DecodedImage(upright, width, height);
            } finally {
                reader.dispose();
            }
        }
    }

    /**
     * The orientation a JPEG's EXIF block declares, or {@code null} when there
     * is none. Only JPEG is asked: the lookup reads the JPEG-native metadata
     * tree, which other readers do not offer. A malformed EXIF block is treated
     * as no tag — a sideways thumbnail beats no thumbnail.
     */
    private static Orientation exifOrientation(ImageReader reader) throws IOException {
        if (!"jpeg".equalsIgnoreCase(reader.getFormatName())) {
            return null;
        }
        try {
            return ExifUtils.getExifOrientation(reader, 0);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Orientations 5–8 store the image transposed: its upright width is the stored height. */
    private static boolean swapsDimensions(Orientation orientation) {
        return orientation == Orientation.LEFT_TOP
            || orientation == Orientation.RIGHT_TOP
            || orientation == Orientation.RIGHT_BOTTOM
            || orientation == Orientation.LEFT_BOTTOM;
    }

    /**
     * The smallest step {@code s} with {@code pixels / s² <= budget}.
     *
     * <p>Being the smallest, {@code s - 1} was too small, so the subsampled
     * image keeps more than {@code budget * ((s-1)/s)²}, which for {@code s >= 2}
     * is at least {@code budget / 4} pixels — 6 MP for the default budget, a
     * longest edge of at least 2 449 px whatever the aspect ratio.
     */
    static int subsamplingStep(long pixels, long budget) {
        if (pixels <= budget) {
            return 1;
        }
        return (int) Math.ceil(Math.sqrt((double) pixels / budget));
    }
}
