package com.photographplatform.api.auth.repository;

import com.photographplatform.api.auth.domain.MagicLinkToken;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MagicLinkTokenRepository extends JpaRepository<MagicLinkToken, UUID> {

    Optional<MagicLinkToken> findByTokenHash(String tokenHash);

    /**
     * Marks every still-active magic-link token for {@code userId} as used.
     * Used both when a token is consumed (defence in depth — there should be
     * only one active token at a time) and when a fresh request is issued so
     * an earlier link cannot be replayed after the user clicks Resend.
     */
    @Modifying
    @Query("update MagicLinkToken t set t.usedAt = :now "
        + "where t.userId = :userId and t.usedAt is null")
    void invalidateAllForUser(@Param("userId") UUID userId,
                              @Param("now") OffsetDateTime now);
}
