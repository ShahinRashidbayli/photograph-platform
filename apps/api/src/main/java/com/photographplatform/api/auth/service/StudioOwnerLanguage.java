package com.photographplatform.api.auth.service;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.tenant.domain.Tenant;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The language a studio's owner reads Fotolio in, for the Notifications that
 * go to the studio's owner address (#126).
 *
 * <p>Here rather than in each module that sends one, so lead and inquiry do
 * not each reach into {@code users} with their own copy of the lookup.
 */
@Component
public class StudioOwnerLanguage {

    private final UserRepository userRepository;

    public StudioOwnerLanguage(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * The language of the account behind the studio's owner address. A studio
     * whose owner address has no account (none should) gets German.
     */
    @Transactional(readOnly = true)
    public CustomerLanguage of(Tenant tenant) {
        return userRepository.findByTenantIdAndEmail(tenant.getId(), tenant.getOwnerEmail())
            .map(User::getLanguage)
            .orElse(CustomerLanguage.DEFAULT);
    }
}
