package com.photographplatform.api.common.media;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;

/**
 * Builds the JPEG a phone writes for a portrait shot: landscape pixels plus an
 * EXIF {@code Orientation} tag. ImageIO cannot write EXIF, so the APP1 segment
 * is spliced in by hand after the JFIF header.
 */
public final class ExifJpegFixture {

    /** The colour of the stored image's top-left quadrant; the rest is {@link #BACKGROUND}. */
    public static final Color MARKER = Color.RED;
    public static final Color BACKGROUND = Color.BLUE;

    private ExifJpegFixture() {
    }

    /** A {@code width × height} JPEG, top-left quadrant {@link #MARKER}, tagged with {@code orientation}. */
    public static byte[] jpeg(int width, int height, int orientation) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(BACKGROUND);
        g.fillRect(0, 0, width, height);
        g.setColor(MARKER);
        g.fillRect(0, 0, width / 2, height / 2);
        g.dispose();

        ByteArrayOutputStream encoded = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", encoded);
        return withOrientation(encoded.toByteArray(), orientation);
    }

    private static byte[] withOrientation(byte[] jpeg, int orientation) {
        // SOI (2 bytes), then ImageIO's JFIF APP0 whose length field follows its marker.
        int app0Length = ((jpeg[4] & 0xFF) << 8) | (jpeg[5] & 0xFF);
        int insertAt = 4 + app0Length;

        ByteBuffer tiff = ByteBuffer.allocate(26)
            .put("MM".getBytes(StandardCharsets.US_ASCII)) // big-endian
            .putShort((short) 42)
            .putInt(8)                                     // offset of IFD0
            .putShort((short) 1)                           // one entry
            .putShort((short) 0x0112)                      // Orientation
            .putShort((short) 3)                           // SHORT
            .putInt(1)                                     // count
            .putShort((short) orientation)
            .putShort((short) 0)                           // value padding
            .putInt(0);                                    // no next IFD
        byte[] exifHeader = "Exif\0\0".getBytes(StandardCharsets.US_ASCII);
        int segmentLength = 2 + exifHeader.length + tiff.capacity();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg, 0, insertAt);
        out.write(0xFF);
        out.write(0xE1);
        out.write(segmentLength >> 8);
        out.write(segmentLength & 0xFF);
        out.writeBytes(exifHeader);
        out.writeBytes(tiff.array());
        out.write(jpeg, insertAt, jpeg.length - insertAt);
        return out.toByteArray();
    }
}
