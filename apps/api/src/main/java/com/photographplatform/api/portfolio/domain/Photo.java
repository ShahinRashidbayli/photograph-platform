package com.photographplatform.api.portfolio.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "photos")
public class Photo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "category_id")
    private UUID categoryId;

    @Column(name = "r2_key", nullable = false, length = 500)
    private String r2Key;

    @Column(name = "thumbnail_key", length = 500)
    private String thumbnailKey;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "is_published", nullable = false)
    private boolean isPublished;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected Photo() {
    }

    public Photo(String r2Key, UUID categoryId) {
        this.r2Key = r2Key;
        this.categoryId = categoryId;
        this.sortOrder = 0;
        this.isPublished = false;
    }

    public UUID getId() {
        return id;
    }

    public UUID getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(UUID categoryId) {
        this.categoryId = categoryId;
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

    public Long getFileSizeBytes() {
        return fileSizeBytes;
    }

    public void setFileSizeBytes(Long fileSizeBytes) {
        this.fileSizeBytes = fileSizeBytes;
    }

    public Integer getWidth() {
        return width;
    }

    public void setWidth(Integer width) {
        this.width = width;
    }

    public Integer getHeight() {
        return height;
    }

    public void setHeight(Integer height) {
        this.height = height;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public boolean isPublished() {
        return isPublished;
    }

    public void setPublished(boolean published) {
        this.isPublished = published;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
