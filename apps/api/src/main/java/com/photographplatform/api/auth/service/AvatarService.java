package com.photographplatform.api.auth.service;

import com.photographplatform.api.auth.dto.AvatarPresignResponse;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.media.ImageUploadType;
import com.photographplatform.api.common.media.UploadLimits;
import com.photographplatform.api.portfolio.config.R2Properties;
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

    private final Optional<R2StorageService> storage;
    private final R2Properties props;

    public AvatarService(Optional<R2StorageService> storage, R2Properties props) {
        this.storage = storage;
        this.props = props;
    }

    /**
     * @param contentType   the image type the browser is about to upload.
     *                      Checked against {@link ImageUploadType}'s whitelist
     *                      rather than passed through: this value is pinned into
     *                      the pre-signed URL and becomes what object storage
     *                      serves the bytes as, so an unchecked one would let
     *                      any account publish an HTML page from the bucket.
     * @param fileSizeBytes the file's exact size, signed into the URL so the
     *                      upload cannot exceed it
     * @return the upload URL, a view URL, and the object key the caller must
     *         persist via {@code PATCH /api/auth/me}. The view URL expires (see
     *         {@code app.r2.presigned-expiry-minutes}), so only the key is safe
     *         to store.
     */
    public AvatarPresignResponse presign(String contentType, long fileSizeBytes) {
        return presign(contentType, fileSizeBytes, "avatars");
    }

    /**
     * The same upload, filed under a different prefix.
     *
     * <p>Added for studio logos, which are the same shape of problem — a small
     * image the browser uploads straight to R2 — and would otherwise have
     * needed a second copy of the type whitelist, the size cap and the
     * pre-signing. The prefix is a caller-supplied constant, never user input.
     */
    public AvatarPresignResponse presign(String contentType, long fileSizeBytes, String prefix) {
        R2StorageService r2 = storage.orElseThrow(() -> new IllegalStateException(
            "R2 storage is not configured. Please contact support."));

        // No filename to fall back on here — the endpoint takes a type and
        // nothing else — so an unrecognised type is simply refused rather than
        // quietly renamed .jpg, which is what this used to do.
        ImageUploadType type = ImageUploadType.resolve(contentType, null);
        long sizeBytes = UploadLimits.requireWithin(
            fileSizeBytes, props.getMaxAvatarBytes(), "Profile photo");

        String key = prefix + "/" + TenantContext.getTenant() + "/" + UUID.randomUUID()
            + type.extension();

        return new AvatarPresignResponse(
            r2.generateUploadUrl(key, type.contentType(), sizeBytes),
            r2.generateDownloadUrl(key),
            key,
            type.contentType()
        );
    }
}
