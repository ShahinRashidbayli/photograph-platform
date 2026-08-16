package com.photographplatform.api.gallery.repository;

import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Tenant-scoped by Postgres Row-Level Security (see
 * {@code V11__tenant_rls.sql}), so every query is confined to the caller's
 * tenant — no explicit tenant filter is needed in the query methods here.
 */
public interface DeliveryPhotoRepository extends JpaRepository<DeliveryPhoto, UUID> {

    List<DeliveryPhoto> findByGalleryIdOrderBySortOrderAsc(UUID galleryId);
}
