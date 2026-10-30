package com.photographplatform.api.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

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
}
