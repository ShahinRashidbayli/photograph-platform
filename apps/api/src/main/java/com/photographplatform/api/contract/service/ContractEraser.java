package com.photographplatform.api.contract.service;

import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.ErasureSubject;
import com.photographplatform.api.common.privacy.PersonalDataEraser;
import com.photographplatform.api.common.privacy.RetentionBasis;
import com.photographplatform.api.contract.domain.Contract;
import com.photographplatform.api.contract.domain.ContractStatus;
import com.photographplatform.api.contract.repository.ContractRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deletes the subject's unsigned contracts and keeps the signed ones.
 *
 * <p>A signed contract is the evidence of what both sides agreed — name,
 * address and signature included — and is kept for the limitation period
 * under Art. 17(3)(e). A draft, a sent-but-unsigned or a cancelled contract
 * proves nothing and goes.
 */
@Component
@Order(500)
@Transactional(propagation = Propagation.MANDATORY)
public class ContractEraser implements PersonalDataEraser {

    private final ContractRepository contractRepository;

    public ContractEraser(ContractRepository contractRepository) {
        this.contractRepository = contractRepository;
    }

    @Override
    public List<ErasureOutcome> erase(ErasureSubject subject) {
        Map<Boolean, List<Contract>> bySigned = contractRepository
            .findByBookingIdInOrRecipientEmailIgnoreCase(subject.bookingIds(), subject.email()).stream()
            .collect(Collectors.partitioningBy(c -> c.getStatus() == ContractStatus.SIGNED));
        List<Contract> unsigned = bySigned.get(false);
        contractRepository.deleteAll(unsigned);
        int signed = bySigned.get(true).size();
        return List.of(new ErasureOutcome(
            "contracts", unsigned.size(), 0, signed, signed > 0 ? RetentionBasis.LEGAL_CLAIMS : null));
    }
}
