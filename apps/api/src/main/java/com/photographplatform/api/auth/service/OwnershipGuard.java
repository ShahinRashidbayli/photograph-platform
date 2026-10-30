package com.photographplatform.api.auth.service;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.SecurityUtils;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The gate for anything only a studio's owner may do.
 *
 * <p>Seats made this necessary. Until a studio could hold two photographers,
 * "authenticated as staff in this tenant" and "allowed to change what the
 * studio pays for" were the same sentence, and every endpoint under
 * {@code /api/**} was gated on the first. They are now different questions,
 * and the gap between them is where the money is: a member who could open
 * Stripe onboarding would be attaching their own bank account to the studio's
 * payouts.
 *
 * <p>Not a Spring Security authority, because that would mean putting
 * {@code staff_role} in the JWT — invalidating every token in circulation on
 * deploy, and pinning ownership to a claim that goes stale the moment it is
 * transferred. This reads the row instead.
 */
@Component
public class OwnershipGuard {

    private final UserRepository userRepository;

    public OwnershipGuard(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Whether the caller owns the studio they are acting in.
     *
     * <p>For read paths that shape a response — a screen hiding controls the
     * API would refuse. Never use it to decide whether to perform a write:
     * that is {@link #requireOwner()}, which throws, because the failure mode
     * of a boolean gate is forgetting to check it.
     */
    @Transactional(readOnly = true)
    public boolean isCurrentUserOwner() {
        UUID tenantId = SecurityUtils.currentTenantId();
        if (tenantId == null) {
            return false;
        }
        return userRepository.findById(SecurityUtils.requireCurrentUserId())
            .filter(u -> u.getTenantId().equals(tenantId))
            .map(User::isOwner)
            .orElse(false);
    }

    /**
     * Asserts ownership and returns the account, so callers that need the row
     * do not fetch it twice.
     *
     * @throws UnauthorizedException if the caller is a member, or is not in the
     *                               tenant they claim to be acting in
     */
    @Transactional(readOnly = true)
    public User requireOwner() {
        return requireOwner(SecurityUtils.requireCurrentTenantId(),
            SecurityUtils.requireCurrentUserId());
    }

    /**
     * The same check against an explicit pair, for services that already hold
     * both and should not re-read the security context.
     */
    @Transactional(readOnly = true)
    public User requireOwner(UUID tenantId, UUID actorId) {
        User actor = userRepository.findById(actorId)
            // A token whose tenant no longer matches the account's is either
            // stale or forged; either way it is not this studio's owner.
            .filter(u -> u.getTenantId().equals(tenantId))
            .orElseThrow(() -> new UnauthorizedException("Not your studio"));
        if (!actor.isOwner()) {
            throw new UnauthorizedException("Only the studio owner can do that");
        }
        return actor;
    }
}
