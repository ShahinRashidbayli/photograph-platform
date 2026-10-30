package com.photographplatform.api.auth.repository;

import com.photographplatform.api.auth.domain.EmailVerificationToken;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmailVerificationTokenRepository
    extends JpaRepository<EmailVerificationToken, UUID> {

    Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

    /**
     * Marks every still-active verification token for {@code userId} as used.
     * The timestamp is supplied by the caller because Hibernate refuses to
     * implicitly assign HQL {@code CURRENT_TIMESTAMP} (java.sql.Timestamp) to
     * an {@link OffsetDateTime} property.
     */
    @Modifying
    @Query("update EmailVerificationToken t set t.usedAt = :now "
        + "where t.userId = :userId and t.usedAt is null")
    void invalidateAllForUser(@Param("userId") UUID userId,
                              @Param("now") OffsetDateTime now);
}
