package com.photographplatform.api.roadmap.repository;

import com.photographplatform.api.roadmap.domain.FeatureInterest;
import com.photographplatform.api.roadmap.domain.RoadmapFeature;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FeatureInterestRepository
    extends JpaRepository<FeatureInterest, FeatureInterest.Key> {

    List<FeatureInterest> findByTenantId(UUID tenantId);

    /**
     * Withdrawing interest.
     *
     * <p>A delete rather than a flag: the row means "wants this", and a row that
     * means "used to want this" is not something the tally should have to reason
     * about. Idempotent — removing interest nobody registered is a no-op, which
     * is what a toggle needs.
     */
    @Modifying
    @Query("DELETE FROM FeatureInterest f WHERE f.tenantId = :tenantId AND f.feature = :feature")
    int deleteInterest(@Param("tenantId") UUID tenantId, @Param("feature") RoadmapFeature feature);
}
