package com.photographplatform.api.auth.repository;

import com.photographplatform.api.auth.domain.LoginCode;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LoginCodeRepository extends JpaRepository<LoginCode, UUID> {

    /**
     * The user's one live login code.
     *
     * <p>Lookup is by user rather than by hash because the code is only six
     * digits: hashing it needs the user id as a salt, so the user must be
     * resolved (from subdomain + email) first. {@code issueAndSendCode}
     * invalidates prior codes, so at most one row should match — ordering by
     * {@code createdAt} makes the newest win regardless, rather than depending on
     * that invariant holding.
     */
    Optional<LoginCode> findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(UUID userId);

    /**
     * Marks every still-active login code for {@code userId} as used. Called
     * both when a code is consumed (defence in depth — there should only ever
     * be one live code at a time) and when a fresh one is issued, so an earlier
     * code cannot be replayed after the customer clicks Resend.
     */
    /**
     * How many codes this user has been issued since {@code since}.
     *
     * <p>Backs the per-email ceiling that has to hold when Redis does not.
     * Counts every row, used or not: the question is how many were *sent*, and
     * a code that was used or superseded was still an email and still a guess
     * the attacker got to make.
     */
    long countByUserIdAndCreatedAtAfter(UUID userId, OffsetDateTime since);

    @Modifying
    @Query("update LoginCode t set t.usedAt = :now "
        + "where t.userId = :userId and t.usedAt is null")
    void invalidateAllForUser(@Param("userId") UUID userId,
                              @Param("now") OffsetDateTime now);
}
