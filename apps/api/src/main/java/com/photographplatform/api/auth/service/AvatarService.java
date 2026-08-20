package com.photographplatform.api.auth.service;

import com.photographplatform.api.auth.dto.AvatarPresignResponse;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.portfolio.service.R2StorageService;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Profile-photo uploads: hands the browser a pre-signed PUT so the image goes
 * straight to R2 and never passes through this application.
 *
 * <p>Extracted from {@code AuthController}, which was choosing file
 * extensions, composing object keys and calling the storage client inline —
 * decisions about how media is laid out in the bucket, which is not something
 * an HTTP layer should own.
 */
@Service
public class AvatarService {

    private static final String DEFAULT_CONTENT_TYPE = "image/jpeg";

    private final Optional<R2StorageService> storage;

    public AvatarService(Optional<R2StorageService> storage) {
        this.storage = storage;
    }

    /**
     * @param contentType the image type the browser is about to upload;
     *                    anything unrecognised is named {@code .jpg}, since the
     *                    extension is only a convenience for humans browsing
     *                    the bucket — the pre-signed PUT pins the real content
     *                    type
     * @return the upload URL, a view URL, and the object key the caller must
     *         persist via {@code PATCH /api/auth/me}. The view URL expires (see
     *         {@code app.r2.presigned-expiry-minutes}), so only the key is safe
     *         to store.
     */
    public AvatarPresignResponse presign(String contentType) {
        R2StorageService r2 = storage.orElseThrow(() -> new IllegalStateException(
            "R2 storage is not configured. Please contact support."));

        String resolvedType = contentType == null || contentType.isBlank()
            ? DEFAULT_CONTENT_TYPE
            : contentType;
        String key = "avatars/" + TenantContext.getTenant() + "/" + UUID.randomUUID()
            + extensionFor(resolvedType);

        return new AvatarPresignResponse(
            r2.generateUploadUrl(key, resolvedType),
            r2.generateDownloadUrl(key),
            key
        );
    }

    private static String extensionFor(String contentType) {
        String normalized = Normalize.lower(contentType);
        if (normalized == null) {
            return ".jpg";
        }
        if (normalized.contains("png")) {
            return ".png";
        }
        if (normalized.contains("webp")) {
            return ".webp";
        }
        return ".jpg";
    }
}
