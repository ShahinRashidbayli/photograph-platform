package com.photographplatform.api.lead.repository;

import com.photographplatform.api.lead.domain.Lead;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LeadRepository extends JpaRepository<Lead, UUID> {
    Page<Lead> findByScore(String score, Pageable pageable);

    Page<Lead> findByStatus(String status, Pageable pageable);

    Page<Lead> findByScoreAndStatus(String score, String status, Pageable pageable);

    List<Lead> findTop5ByOrderByCreatedAtDesc();
}
