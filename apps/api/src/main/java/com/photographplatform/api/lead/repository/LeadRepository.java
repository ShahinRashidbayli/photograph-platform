package com.photographplatform.api.lead.repository;

import com.photographplatform.api.lead.domain.Lead;
import jakarta.persistence.QueryHint;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

public interface LeadRepository extends JpaRepository<Lead, UUID> {

    /*
     * Slice, not Page: the endpoint answers a JSON array and never carried the
     * totals a Page pays a second COUNT query to produce. See
     * BookingRepository for the same reasoning.
     */

    Slice<Lead> findAllBy(Pageable pageable);

    Slice<Lead> findByScore(String score, Pageable pageable);

    Slice<Lead> findByStatus(String status, Pageable pageable);

    Slice<Lead> findByScoreAndStatus(String score, String status, Pageable pageable);

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

    /** Every lead from one address, for Art. 17 erasure. */
    List<Lead> findByEmailIgnoreCase(String email);

    /**
     * The newest phone number each address gave on a lead. An address whose
     * leads gave none is absent. Filtered on the tenant as well as RLS: the
     * same address can be a lead of two studios.
     */
    @Query(value = """
        SELECT DISTINCT ON (lower(btrim(l.email)))
               lower(btrim(l.email)) AS email, btrim(l.phone) AS phone
        FROM leads l
        WHERE l.tenant_id = :tenantId
          AND lower(btrim(l.email)) IN (:emails)
          AND btrim(l.phone) <> ''
        ORDER BY lower(btrim(l.email)), l.created_at DESC
        """, nativeQuery = true)
    List<LatestPhone> findLatestPhones(@Param("tenantId") UUID tenantId, @Param("emails") Collection<String> emails);

    interface LatestPhone {
        String getEmail();
        String getPhone();
    }
}
