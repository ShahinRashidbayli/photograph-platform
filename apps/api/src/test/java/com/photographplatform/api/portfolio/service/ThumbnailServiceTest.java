package com.photographplatform.api.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.photographplatform.api.common.media.BoundedImageDecoder;
import com.photographplatform.api.common.media.ExifJpegFixture;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ThumbnailServiceTest {

    @Test
    void thumbnailKeyForRetainsTenantPrefix() {
        String result = ThumbnailService.thumbnailKeyFor(
            "11111111-2222-3333-4444-555555555555/photos/abc.jpg");
        assertThat(result).isEqualTo(
            "11111111-2222-3333-4444-555555555555/photos/thumb_abc.jpg");
    }

    @Test
    void thumbnailKeyForReplacesExtensionWithJpg() {
        // PNG/WebP originals all produce JPG thumbnails — keeps the contract
        // simple and the consumer doesn't have to inspect the key to know.
        assertThat(ThumbnailService.thumbnailKeyFor("t/photos/img.png"))
            .isEqualTo("t/photos/thumb_img.jpg");
        assertThat(ThumbnailService.thumbnailKeyFor("t/photos/img.webp"))
            .isEqualTo("t/photos/thumb_img.jpg");
    }

    @Test
    void thumbnailKeyForHandlesKeyWithoutDirectory() {
        assertThat(ThumbnailService.thumbnailKeyFor("abc.jpg"))
            .isEqualTo("thumb_abc.jpg");
    }

    @Test
    void thumbnailKeyForHandlesKeyWithoutExtension() {
        assertThat(ThumbnailService.thumbnailKeyFor("t/photos/abc"))
            .isEqualTo("t/photos/thumb_abc.jpg");
    }

    /**
     * A portrait phone photo: 600 × 400 stored pixels, EXIF-tagged to be shown
     * rotated a quarter turn. The thumbnail is portrait, 400 px on its long edge
     * and 400 × 400 / 600 ≈ 267 px on its short one.
     */
    @ParameterizedTest
    @ValueSource(ints = {6, 8})
    void thumbnailOfAnExifRotatedJpegIsUpright(int orientation) throws IOException {
        byte[] original = ExifJpegFixture.jpeg(600, 400, orientation);

        byte[] thumbnail = ThumbnailService.renderThumbnail(BoundedImageDecoder.decode(original).image());

        BufferedImage rendered = ImageIO.read(new ByteArrayInputStream(thumbnail));
        assertThat(rendered.getWidth()).isEqualTo(267);
        assertThat(rendered.getHeight()).isEqualTo(400);
    }
}
