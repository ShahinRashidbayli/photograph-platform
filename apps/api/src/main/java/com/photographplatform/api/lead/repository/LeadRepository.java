package com.photographplatform.api.lead.repository;

import com.photographplatform.api.lead.domain.Lead;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.QueryHints;
import jakarta.persistence.QueryHint;

public interface LeadRepository extends JpaRepository<Lead, UUID> {
    Page<Lead> findByScore(String score, Pageable pageable);

    Page<Lead> findByStatus(String status, Pageable pageable);

    Page<Lead> findByScoreAndStatus(String score, String status, Pageable pageable);

    /**
     * Cursor-backed stream of every lead in the tenant, for the CSV export.
     *
     * <p>{@code HINT_FETCH_SIZE} is what actually makes it stream: without it
     * the PostgreSQL JDBC driver buffers the entire result set client-side
     * before returning the first row, which would defeat the point. The stream
     * must be closed (and consumed inside the read transaction) — it holds the
     * cursor open.
     */
    @QueryHints(@QueryHint(name = org.hibernate.jpa.AvailableHints.HINT_FETCH_SIZE, value = "200"))
    Stream<Lead> streamAllByOrderByCreatedAtDesc();
}
