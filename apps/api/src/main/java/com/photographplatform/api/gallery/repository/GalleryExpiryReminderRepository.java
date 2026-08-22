package com.photographplatform.api.gallery.repository;

import com.photographplatform.api.gallery.domain.GalleryExpiryReminder;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GalleryExpiryReminderRepository extends JpaRepository<GalleryExpiryReminder, UUID> {

    @Query("SELECT r.daysBefore FROM GalleryExpiryReminder r WHERE r.galleryId = :galleryId")
    List<Integer> findSentThresholds(@Param("galleryId") UUID galleryId);
}
