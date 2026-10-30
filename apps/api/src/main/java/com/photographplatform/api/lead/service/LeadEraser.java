package com.photographplatform.api.lead.service;

import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.ErasureSubject;
import com.photographplatform.api.common.privacy.PersonalDataEraser;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.repository.LeadRepository;
import java.util.List;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deletes every lead the subject sent — name, phone, message, the IP address
 * it came from and the photographer's notes on it.
 */
@Component
@Order(700)
@Transactional(propagation = Propagation.MANDATORY)
public class LeadEraser implements PersonalDataEraser {

    private final LeadRepository leadRepository;

    public LeadEraser(LeadRepository leadRepository) {
        this.leadRepository = leadRepository;
    }

    @Override
    public List<ErasureOutcome> erase(ErasureSubject subject) {
        List<Lead> leads = leadRepository.findByEmailIgnoreCase(subject.email());
        leadRepository.deleteAll(leads);
        return List.of(ErasureOutcome.deleted("leads", leads.size()));
    }
}
