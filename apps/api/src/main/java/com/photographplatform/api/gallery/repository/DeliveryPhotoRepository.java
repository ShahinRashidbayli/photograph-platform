package com.photographplatform.api.gallery.repository;

import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Tenant-scoped by the routing data source's search_path, so every query is
 * confined to the caller's schema — no explicit tenant column is needed.
 */
public interface DeliveryPhotoRepository extends JpaRepository<DeliveryPhoto, UUID> {

    List<DeliveryPhoto> findByGalleryIdOrderBySortOrderAsc(UUID galleryId);

    long countByGalleryId(UUID galleryId);
}
