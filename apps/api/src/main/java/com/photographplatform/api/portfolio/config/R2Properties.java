package com.photographplatform.api.portfolio.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.r2")
public class R2Properties {

    private String endpoint;
    private String accessKey;
    private String secretKey;
    private String bucket;
    private int presignedExpiryMinutes = 60;

    /**
     * Address objects as {@code <endpoint>/<bucket>/<key>} instead of
     * {@code <bucket>.<endpoint>/<key>}.
     *
     * <p>Cloudflare R2 serves virtual-host style, which is why this defaults
     * to false and production config never sets it. Local S3 substitutes
     * (MinIO on {@code localhost:9000}) cannot do virtual-host addressing —
     * {@code bucket.localhost} does not resolve — so the dev profile turns it
     * on. Getting this wrong is not a subtle failure: presigned URLs are
     * signed for whichever form is configured, so a mismatch makes every
     * upload and every gallery image 403 with a signature error.
     */
    private boolean pathStyle = false;

    /**
     * Largest photo a pre-signed PUT will be issued for, in bytes.
     *
     * <p>A pre-signed PUT carries no size limit of its own: whoever holds the
     * URL can write as many bytes as they like under it. Nothing else caps this
     * either — the per-plan {@code fairUseStorageGb} is served to the frontend
     * and never enforced, and the size recorded against a photo used to be
     * whatever the client claimed at complete-time. So one account could fill
     * the shared bucket and report having stored nothing.
     *
     * <p>The limit is enforced by signing {@code Content-Length} into the URL
     * (see {@code R2StorageService#generateUploadUrl}), which makes the size a
     * term of the signature rather than a promise: the client declares it up
     * front, we refuse anything above this ceiling, and object storage refuses
     * any upload whose actual length differs from what was signed.
     *
     * <p>50 MB is comfortably above a full-frame JPEG straight out of a camera
     * and well below anything that would be a photo rather than a mistake.
     */
    private long maxUploadBytes = 50L * 1024 * 1024;

    /**
     * Same, for profile photos. Much smaller because an avatar is displayed at
     * a few hundred pixels and has no reason to be a camera original.
     */
    private long maxAvatarBytes = 5L * 1024 * 1024;

    public String getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    public String getAccessKey() {
        return accessKey;
    }

    public void setAccessKey(String accessKey) {
        this.accessKey = accessKey;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getBucket() {
        return bucket;
    }

    public void setBucket(String bucket) {
        this.bucket = bucket;
    }

    public int getPresignedExpiryMinutes() {
        return presignedExpiryMinutes;
    }

    public void setPresignedExpiryMinutes(int presignedExpiryMinutes) {
        this.presignedExpiryMinutes = presignedExpiryMinutes;
    }

    public boolean isPathStyle() {
        return pathStyle;
    }

    public void setPathStyle(boolean pathStyle) {
        this.pathStyle = pathStyle;
    }

    public long getMaxUploadBytes() {
        return maxUploadBytes;
    }

    public void setMaxUploadBytes(long maxUploadBytes) {
        this.maxUploadBytes = maxUploadBytes;
    }

    public long getMaxAvatarBytes() {
        return maxAvatarBytes;
    }

    public void setMaxAvatarBytes(long maxAvatarBytes) {
        this.maxAvatarBytes = maxAvatarBytes;
    }
}
