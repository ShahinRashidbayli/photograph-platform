package com.photographplatform.api.booking.service;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Which customer account, if any, an address belongs to in a given tenant.
 *
 * <p>Every write path links the booking it creates, which is what keeps the
 * email fallback in {@code BookingRepository#OWNED_BY_CALLER} rare: bookings
 * then name their customer outright, and only ones taken for somebody who has
 * never signed in stay resolvable by address alone. Those are also the only
 * ones where editing {@code client_email} still moves who can see them.
 *
 * <p>Its own component for the same reason as {@link BookingPricingResolver}:
 * both write services need it, and one calling the other for four lines would
 * couple them for nothing.
 */
@Component
public class CustomerAccountResolver {

    private final UserRepository userRepository;

    public CustomerAccountResolver(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * @param tenantId passed explicitly rather than assumed: V11 leaves {@code
     *     users} without a row-level policy, so nothing else scopes this
     * @return the customer's user id, or null if this address has no account
     *     here. Staff are excluded — a photographer who is also another
     *     studio's client has two rows, and only one of them is the client.
     */
    public UUID forEmail(String email, UUID tenantId) {
        return userRepository.findByTenantIdAndEmail(tenantId, email)
            .filter(u -> u.getStaffRole() == null)
            .map(User::getId)
            .orElse(null);
    }
}
