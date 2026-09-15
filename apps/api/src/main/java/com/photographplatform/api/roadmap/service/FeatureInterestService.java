package com.photographplatform.api.roadmap.service;

import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.roadmap.domain.FeatureInterest;
import com.photographplatform.api.roadmap.domain.RoadmapFeature;
import com.photographplatform.api.roadmap.repository.FeatureInterestRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Which unbuilt ideas this studio has asked for.
 *
 * <p>Both writes are idempotent, because the UI is a toggle and a toggle gets
 * double-clicked. Registering twice is the same as registering once, and
 * withdrawing something never registered is not an error — insisting otherwise
 * would mean the button could fail for a photographer who did nothing wrong.
 */
@Service
public class FeatureInterestService {

    private final FeatureInterestRepository repository;

    public FeatureInterestService(FeatureInterestRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<String> listForCurrentTenant() {
        return repository.findByTenantId(SecurityUtils.requireCurrentTenantId())
            .stream()
            .map(interest -> interest.getFeature().name())
            .toList();
    }

    @Transactional
    public void register(RoadmapFeature feature) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        try {
            repository.save(new FeatureInterest(tenantId, feature));
        } catch (DataIntegrityViolationException alreadyRegistered) {
            // The primary key did its job under a concurrent double-submit.
            // Nothing to repair: the desired state is exactly what is stored.
        }
    }

    @Transactional
    public void withdraw(RoadmapFeature feature) {
        repository.deleteInterest(SecurityUtils.requireCurrentTenantId(), feature);
    }
}
