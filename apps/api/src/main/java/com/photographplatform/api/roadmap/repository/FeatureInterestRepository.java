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
     * Registering interest, as one statement that cannot fail on a duplicate.
     *
     * <p>Not {@code save()}: a new entity's INSERT is only sent at flush, which
     * is at commit, outside any {@code try} in the service. Two PUTs from a
     * double click both inserted, the second hit the primary key at commit and
     * returned 409. Here the primary key still decides, and a duplicate is a
     * no-op the way {@code ProcessedStripeEventRepository#tryClaim} is.
     */
    @Modifying
    @Query(value = """
        INSERT INTO feature_interest (tenant_id, feature) VALUES (:tenantId, :feature)
        ON CONFLICT (tenant_id, feature) DO NOTHING
        """, nativeQuery = true)
    int registerInterest(@Param("tenantId") UUID tenantId, @Param("feature") String feature);

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
