package com.photographplatform.api.portfolio.repository;

import com.photographplatform.api.portfolio.domain.Photo;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PhotoRepository extends JpaRepository<Photo, UUID> {

    List<Photo> findByCategoryIdOrderBySortOrderAsc(UUID categoryId);

    List<Photo> findByIsPublishedTrueOrderBySortOrderAsc();
}
