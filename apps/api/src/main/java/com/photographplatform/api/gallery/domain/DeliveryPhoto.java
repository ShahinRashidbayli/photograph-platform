package com.photographplatform.api.gallery.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/**
 * One delivered photo inside a client gallery. Distinct from the portfolio
 * {@code Photo} (public marketing images): delivery photos are private to the
 * gallery's access token and are never published to the portfolio page.
 */
@Entity
@Table(name = "delivery_photos")
public class DeliveryPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "gallery_id", nullable = false)
    private UUID galleryId;

    @Column(name = "r2_key", nullable = false, length = 500)
    private String r2Key;

    @Column(name = "thumbnail_key", length = 500)
    private String thumbnailKey;

    /**
     * The watermarked derivative served to the client when the gallery has
     * watermarking on. Null until one has been generated. The original in
     * {@link #r2Key} is never overwritten, so switching the flag off restores
     * clean delivery without re-uploading.
     */
    @Column(name = "watermark_key", length = 500)
    private String watermarkKey;

    @Column(name = "original_filename", length = 255)
    private String originalFilename;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    protected DeliveryPhoto() {
    }

    public DeliveryPhoto(UUID galleryId, String r2Key, String originalFilename) {
        this.galleryId = galleryId;
        this.r2Key = r2Key;
        this.originalFilename = originalFilename;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getGalleryId() {
        return galleryId;
    }

    public String getR2Key() {
        return r2Key;
    }

    public String getThumbnailKey() {
        return thumbnailKey;
    }

    public void setThumbnailKey(String thumbnailKey) {
        this.thumbnailKey = thumbnailKey;
    }

    public String getWatermarkKey() {
        return watermarkKey;
    }

    public void setWatermarkKey(String watermarkKey) {
        this.watermarkKey = watermarkKey;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public Long getFileSizeBytes() {
        return fileSizeBytes;
    }

    public Integer getWidth() {
        return width;
    }

    public Integer getHeight() {
        return height;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setFileSizeBytes(Long fileSizeBytes) {
        this.fileSizeBytes = fileSizeBytes;
    }

    public void setWidth(Integer width) {
        this.width = width;
    }

    public void setHeight(Integer height) {
        this.height = height;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
