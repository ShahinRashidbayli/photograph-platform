package com.photographplatform.api.auth.service;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.ErasureSubject;
import com.photographplatform.api.common.privacy.PersonalDataEraser;
import java.util.List;
import java.util.Optional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Erasure of the subject's customer account in this studio.
 *
 * <p>First in the identify pass: inquiries and bookings name the account, so
 * its id has to be known before anything else is looked up.
 *
 * <p>Only a {@code CUSTOMER} account is ever touched. A colleague whose address
 * happens to match is a member of staff, and removing a staff account is
 * leaving the studio — {@code /api/team} — not erasure.
 *
 * <p>Deleting the row takes its login codes, refresh, verification and reset
 * tokens with it ({@code ON DELETE CASCADE}); bookings and contracts that
 * named it fall back to {@code NULL} ({@code ON DELETE SET NULL}).
 */
@Component
@Order(100)
@Transactional(propagation = Propagation.MANDATORY)
public class CustomerAccountEraser implements PersonalDataEraser {

    private final UserRepository userRepository;

    public CustomerAccountEraser(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public void identify(ErasureSubject subject) {
        customerAccount(subject).ifPresent(user -> subject.customerUserId(user.getId()));
    }

    @Override
    public List<ErasureOutcome> erase(ErasureSubject subject) {
        Optional<User> account = customerAccount(subject);
        account.ifPresent(userRepository::delete);
        return List.of(ErasureOutcome.deleted("customerAccounts", account.isPresent() ? 1 : 0));
    }

    private Optional<User> customerAccount(ErasureSubject subject) {
        return userRepository.findByTenantIdAndEmail(subject.tenantId(), subject.email())
            .filter(user -> "CUSTOMER".equals(user.getRole()));
    }
}
