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
}
