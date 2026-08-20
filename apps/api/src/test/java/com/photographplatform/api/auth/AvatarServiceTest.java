package com.photographplatform.api.auth;

import com.photographplatform.api.auth.dto.AvatarPresignResponse;
import com.photographplatform.api.auth.service.AvatarService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.portfolio.service.R2StorageService;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Object-key and content-type decisions for avatar uploads — the logic that
 * used to sit inline in {@code AuthController}.
 */
class AvatarServiceTest {

    private static final UUID TENANT_ID = UUID.randomUUID();

    private final R2StorageService storage = mock(R2StorageService.class);
    private final AvatarService service = new AvatarService(Optional.of(storage));

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    private AvatarPresignResponse presignAs(String contentType) {
        TenantContext.setTenant(TENANT_ID.toString());
        when(storage.generateUploadUrl(anyString(), anyString())).thenReturn("https://r2.example/put");
        when(storage.generateDownloadUrl(anyString())).thenReturn("https://r2.example/get");
        return service.presign(contentType);
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

    /** Case-varying types must not fall through to the default. */
    @Test
    void extensionMatchingIsCaseInsensitive() {
        assertThat(presignAs("IMAGE/PNG").r2Key()).endsWith(".png");
        assertThat(presignAs("image/WebP").r2Key()).endsWith(".webp");
    }

    /**
     * An unknown or missing type is stored as .jpg rather than rejected: the
     * extension is a convenience for humans reading the bucket, and the
     * pre-signed PUT pins the real content type either way.
     */
    @Test
    void unknownContentTypeFallsBackToJpg() {
        assertThat(presignAs("application/octet-stream").r2Key()).endsWith(".jpg");
        assertThat(presignAs(null).r2Key()).endsWith(".jpg");
    }

    @Test
    void blankContentTypeIsSignedAsJpeg() {
        presignAs("  ");
        verify(storage).generateUploadUrl(anyString(), eq("image/jpeg"));
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
        AvatarService withoutStorage = new AvatarService(Optional.empty());

        assertThatThrownBy(() -> withoutStorage.presign("image/jpeg"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("R2 storage is not configured");
    }
}
