package com.photographplatform.api.auth;

import com.photographplatform.api.auth.dto.AvatarPresignResponse;
import com.photographplatform.api.auth.service.AvatarService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.portfolio.config.R2Properties;
import com.photographplatform.api.portfolio.service.R2StorageService;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Object-key, content-type and size decisions for avatar uploads — the logic
 * that used to sit inline in {@code AuthController}.
 */
class AvatarServiceTest {

    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final long ONE_MB = 1024L * 1024;

    private final R2StorageService storage = mock(R2StorageService.class);
    private final R2Properties props = new R2Properties();
    private final AvatarService service = new AvatarService(Optional.of(storage), props);

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    private AvatarPresignResponse presignAs(String contentType) {
        return presignAs(contentType, ONE_MB);
    }

    private AvatarPresignResponse presignAs(String contentType, long sizeBytes) {
        TenantContext.setTenant(TENANT_ID.toString());
        when(storage.generateUploadUrl(anyString(), anyString(), anyLong()))
            .thenReturn("https://r2.example/put");
        when(storage.generateDownloadUrl(anyString())).thenReturn("https://r2.example/get");
        return service.presign(contentType, sizeBytes);
    }

    /**
     * The key must be tenant-scoped: it is the only thing separating one
     * photographer's uploads from another's inside a shared bucket.
     */
    @Test
    void keyIsScopedToTheCurrentTenant() {
        AvatarPresignResponse response = presignAs("image/jpeg");

        assertThat(response.r2Key()).startsWith("avatars/" + TENANT_ID + "/");
        assertThat(response.uploadUrl()).isEqualTo("https://r2.example/put");
        assertThat(response.viewUrl()).isEqualTo("https://r2.example/get");
    }

    @Test
    void extensionFollowsTheContentType() {
        assertThat(presignAs("image/png").r2Key()).endsWith(".png");
        assertThat(presignAs("image/webp").r2Key()).endsWith(".webp");
        assertThat(presignAs("image/jpeg").r2Key()).endsWith(".jpg");
    }

    /** Case-varying types must not fall through to a rejection. */
    @Test
    void extensionMatchingIsCaseInsensitive() {
        assertThat(presignAs("IMAGE/PNG").r2Key()).endsWith(".png");
        assertThat(presignAs("image/WebP").r2Key()).endsWith(".webp");
    }

    /**
     * This used to be stored as {@code .jpg} and signed with whatever the
     * caller asked for, on the reasoning that the extension is only a
     * convenience for humans reading the bucket. That reasoning held for the
     * extension and missed the content type: the value handed here is what
     * object storage will serve the bytes back as, so accepting an arbitrary
     * one meant any account could publish an executable page from the bucket.
     */
    @Test
    void aTypeThatIsNotAnAcceptedImageIsRefused() {
        assertThatThrownBy(() -> presignAs("text/html"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Unsupported image type");

        // SVG is the one that looks like it belongs on this list and does not:
        // it is a document format that can carry script.
        assertThatThrownBy(() -> presignAs("image/svg+xml"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Unsupported image type");
    }

    /**
     * Unlike the photo endpoints there is no filename to fall back on here, so
     * "I don't know what this is" cannot be resolved and is refused rather than
     * silently signed as JPEG.
     */
    @Test
    void anUndeclaredTypeIsRefusedRatherThanGuessed() {
        assertThatThrownBy(() -> presignAs("application/octet-stream"))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> presignAs(null))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> presignAs("  "))
            .isInstanceOf(IllegalArgumentException.class);
    }

    /** The parameters R2 signs are the canonical type and the declared size. */
    @Test
    void theUrlIsSignedForTheCanonicalTypeAndTheDeclaredSize() {
        presignAs("image/jpg", 4096);

        verify(storage).generateUploadUrl(anyString(), eq("image/jpeg"), eq(4096L));
    }

    /**
     * Without a ceiling the pre-signed PUT is an unbounded write capability
     * against a shared bucket.
     */
    @Test
    void aFileOverTheAvatarLimitIsRefused() {
        props.setMaxAvatarBytes(ONE_MB);

        assertThatThrownBy(() -> presignAs("image/jpeg", ONE_MB + 1))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("too large");
    }

    @Test
    void aNonPositiveSizeIsRefused() {
        assertThatThrownBy(() -> presignAs("image/jpeg", 0))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("greater than zero");
    }

    @Test
    void everyCallMintsAFreshKeySoUploadsNeverOverwriteEachOther() {
        String first = presignAs("image/jpeg").r2Key();
        String second = presignAs("image/jpeg").r2Key();

        assertThat(first).isNotEqualTo(second);
    }

    /** Without storage this is a misconfiguration, not a user error. */
    @Test
    void missingStorageIsReportedClearly() {
        AvatarService withoutStorage = new AvatarService(Optional.empty(), props);

        assertThatThrownBy(() -> withoutStorage.presign("image/jpeg", ONE_MB))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("R2 storage is not configured");
    }
}
