package com.photographplatform.api.portfolio.repository;

import com.photographplatform.api.portfolio.domain.Photo;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PhotoRepository extends JpaRepository<Photo, UUID> {

    /**
     * Detaches every photo from a category that is being deleted.
     *
     * <p>{@code photos.category_id} carries no foreign key (see V11), so
     * deleting a category left its photos pointing at a row that no longer
     * exists. Postgres raised nothing, but the portfolio UI could no longer
     * reach them: they matched no category chip, and "Uncategorised" filters on
     * {@code categoryId == null}, which a dangling id is not. The photos were
     * visible only under "All" and could not be re-filed.
     */
    @Modifying
    @Query("UPDATE Photo p SET p.categoryId = null WHERE p.categoryId = :categoryId")
    int clearCategory(@Param("categoryId") UUID categoryId);

    List<Photo> findByIsPublishedTrueOrderBySortOrderAsc();

    List<Photo> findAllByOrderBySortOrderAsc();
}
