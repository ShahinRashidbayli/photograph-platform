package com.photographplatform.api.common.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.photographplatform.api.common.media.BoundedImageDecoder.DecodedImage;
import com.photographplatform.api.common.media.BoundedImageDecoder.ImageTooLargeException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class BoundedImageDecoderTest {

    @Test
    void decodesAnImageWithinBudgetAtFullSize() throws IOException {
        DecodedImage decoded = BoundedImageDecoder.decode(encode("jpg", 120, 80));

        assertThat(decoded.image().getWidth()).isEqualTo(120);
        assertThat(decoded.image().getHeight()).isEqualTo(80);
        assertThat(decoded.sourceWidth()).isEqualTo(120);
        assertThat(decoded.sourceHeight()).isEqualTo(80);
    }

    @Test
    void subsamplesAboveBudgetButReportsTheFilesOwnDimensions() throws IOException {
        // 80 000 px against a 20 000 px budget → step 2.
        DecodedImage decoded = BoundedImageDecoder.decode(encode("png", 400, 200), Long.MAX_VALUE, 20_000);

        assertThat(decoded.image().getWidth()).isEqualTo(200);
        assertThat(decoded.image().getHeight()).isEqualTo(100);
        assertThat(decoded.sourceWidth()).isEqualTo(400);
        assertThat(decoded.sourceHeight()).isEqualTo(200);
    }

    /**
     * A phone's portrait JPEG: 80 × 40 stored pixels, tagged to be shown
     * rotated. The decoded image and the reported dimensions are both upright.
     */
    @ParameterizedTest
    @ValueSource(ints = {6, 8})
    void turnsAPortraitJpegUprightFromItsExifOrientation(int orientation) throws IOException {
        DecodedImage decoded = BoundedImageDecoder.decode(ExifJpegFixture.jpeg(80, 40, orientation));

        assertThat(decoded.image().getWidth()).isEqualTo(40);
        assertThat(decoded.image().getHeight()).isEqualTo(80);
        assertThat(decoded.sourceWidth()).isEqualTo(40);
        assertThat(decoded.sourceHeight()).isEqualTo(80);
    }

    /**
     * Where the stored top-left quadrant ends up once upright, for every EXIF
     * orientation: 1–4 keep the dimensions (identity, mirror, 180°, flip),
     * 5–8 transpose them.
     */
    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3, 4, 5, 6, 7, 8})
    void placesThePixelsWhereEveryExifOrientationSays(int orientation) throws IOException {
        DecodedImage decoded = BoundedImageDecoder.decode(ExifJpegFixture.jpeg(80, 40, orientation));
        BufferedImage image = decoded.image();
        boolean transposed = orientation >= 5;

        assertThat(image.getWidth()).isEqualTo(transposed ? 40 : 80);
        assertThat(image.getHeight()).isEqualTo(transposed ? 80 : 40);

        // The stored top-left corner, seen upright, sits at TL, TR, BR, BL for
        // orientations 1–4 and again for 5–8 (EXIF 2.3, tag 0x0112).
        int corner = (orientation - 1) % 4;
        boolean right = corner == 1 || corner == 2;
        boolean bottom = corner == 2 || corner == 3;
        for (int qx = 0; qx < 2; qx++) {
            for (int qy = 0; qy < 2; qy++) {
                boolean marked = (qx == 1) == right && (qy == 1) == bottom;
                int rgb = image.getRGB(image.getWidth() * (1 + 2 * qx) / 4, image.getHeight() * (1 + 2 * qy) / 4);
                assertThat(isRed(rgb))
                    .as("orientation %d, quadrant (%d,%d)", orientation, qx, qy)
                    .isEqualTo(marked);
            }
        }
    }

    @Test
    void leavesAJpegWithoutExifAsStored() throws IOException {
        DecodedImage decoded = BoundedImageDecoder.decode(ExifJpegFixture.jpeg(80, 40, 1));

        assertThat(decoded.sourceWidth()).isEqualTo(80);
        assertThat(isRed(decoded.image().getRGB(10, 10))).isTrue();
    }

    private static boolean isRed(int rgb) {
        int red = (rgb >> 16) & 0xFF;
        int blue = rgb & 0xFF;
        return red > 200 && blue < 60;
    }

    /**
     * The attack this class exists for: a header declaring 30 000 × 30 000
     * pixels (2.7 GB decoded) with no pixel data behind it at all. It must be
     * refused from the header alone — a decoder that tried to read it would
     * fail differently, on the missing image data.
     */
    @Test
    void refusesAnOversizedImageFromItsHeaderAlone() {
        byte[] bomb = pngHeaderOnly(30_000, 30_000);

        assertThatThrownBy(() -> BoundedImageDecoder.decode(bomb))
            .isInstanceOf(ImageTooLargeException.class)
            .hasMessageContaining("30000x30000");
    }

    @Test
    void returnsNullForBytesNoReaderRecognises() throws IOException {
        assertThat(BoundedImageDecoder.decode("not an image".getBytes(StandardCharsets.UTF_8))).isNull();
    }

    @Test
    void leavesCommonCameraSizesAtFullResolutionUpToTheBudget() {
        long budget = BoundedImageDecoder.DECODE_PIXEL_BUDGET;
        assertThat(BoundedImageDecoder.subsamplingStep(6000L * 4000, budget)).isEqualTo(1);   // 24 MP
        assertThat(BoundedImageDecoder.subsamplingStep(8192L * 5464, budget)).isEqualTo(2);   // 45 MP
        assertThat(BoundedImageDecoder.subsamplingStep(9504L * 6336, budget)).isEqualTo(2);   // 61 MP
        assertThat(BoundedImageDecoder.subsamplingStep(11648L * 8736, budget)).isEqualTo(3);  // 102 MP
    }

    /**
     * Whatever the size and aspect ratio, the subsampled raster fits the budget
     * and still leaves enough pixels for the largest derivative (2 400 px).
     */
    @Test
    void subsampledImagesFitTheBudgetAndStayLargeEnoughForEveryDerivative() {
        long budget = BoundedImageDecoder.DECODE_PIXEL_BUDGET;
        for (long width = 1_000; width <= 60_000; width += 997) {
            for (double aspect : new double[] {1.0, 1.5, 3.0, 10.0}) {
                long height = Math.max(1, Math.round(width / aspect));
                long pixels = width * height;
                if (pixels <= budget || pixels > BoundedImageDecoder.MAX_SOURCE_PIXELS) {
                    continue;
                }
                int step = BoundedImageDecoder.subsamplingStep(pixels, budget);
                long outWidth = ceilDiv(width, step);
                long outHeight = ceilDiv(height, step);

                assertThat(pixels / ((long) step * step)).as("%dx%d", width, height).isLessThanOrEqualTo(budget);
                assertThat(Math.max(outWidth, outHeight)).as("%dx%d", width, height).isGreaterThanOrEqualTo(2_400);
            }
        }
    }

    private static long ceilDiv(long a, long b) {
        return (a + b - 1) / b;
    }

    private static byte[] encode(String format, int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    /** A PNG signature, an IHDR declaring the given size, and IEND — no IDAT. */
    private static byte[] pngHeaderOnly(int width, int height) {
        ByteBuffer ihdr = ByteBuffer.allocate(13)
            .putInt(width)
            .putInt(height)
            .put((byte) 8)   // bit depth
            .put((byte) 2)   // colour type: truecolour
            .put((byte) 0)   // compression
            .put((byte) 0)   // filter
            .put((byte) 0);  // interlace
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes(new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'});
        writeChunk(out, "IHDR", ihdr.array());
        writeChunk(out, "IEND", new byte[0]);
        return out.toByteArray();
    }

    private static void writeChunk(ByteArrayOutputStream out, String type, byte[] data) {
        byte[] typeBytes = type.getBytes(StandardCharsets.US_ASCII);
        CRC32 crc = new CRC32();
        crc.update(typeBytes);
        crc.update(data);
        out.writeBytes(ByteBuffer.allocate(4).putInt(data.length).array());
        out.writeBytes(typeBytes);
        out.writeBytes(data);
        out.writeBytes(ByteBuffer.allocate(4).putInt((int) crc.getValue()).array());
    }
}
