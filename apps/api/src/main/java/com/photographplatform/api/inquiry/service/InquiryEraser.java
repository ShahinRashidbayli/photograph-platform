package com.photographplatform.api.inquiry.service;

import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.ErasureSubject;
import com.photographplatform.api.common.privacy.PersonalDataEraser;
import com.photographplatform.api.inquiry.domain.InquiryRequest;
import com.photographplatform.api.inquiry.repository.InquiryRequestRepository;
import java.util.List;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deletes the inquiries the subject filed from their customer account.
 *
 * <p>An inquiry carries no address of its own — only the account that sent
 * it — so without an account there is nothing here to find.
 */
@Component
@Order(600)
@Transactional(propagation = Propagation.MANDATORY)
public class InquiryEraser implements PersonalDataEraser {

    private final InquiryRequestRepository inquiryRepository;

    public InquiryEraser(InquiryRequestRepository inquiryRepository) {
        this.inquiryRepository = inquiryRepository;
    }

    @Override
    public List<ErasureOutcome> erase(ErasureSubject subject) {
        if (subject.customerUserId() == null) {
            return List.of(ErasureOutcome.deleted("inquiries", 0));
        }
        List<InquiryRequest> inquiries = inquiryRepository.findByCustomerId(subject.customerUserId());
        inquiryRepository.deleteAll(inquiries);
        return List.of(ErasureOutcome.deleted("inquiries", inquiries.size()));
    }
}
