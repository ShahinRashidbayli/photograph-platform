package com.photographplatform.api.lead.service;

import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.dto.LeadResponse;
import org.springframework.stereotype.Component;

/**
 * {@link Lead} → {@link LeadResponse}, including the score breakdown the
 * detail panel renders as bars.
 *
 * <p>Extracted so the services that return a lead — {@link LeadService} and
 * {@link LeadConversionService} — don't each carry a copy of the mapping and
 * their own {@link LeadScoringService} dependency just to build it. The
 * breakdown is recomputed from the lead's current inputs rather than read
 * from stored component columns, so it can never disagree with the data it
 * claims to explain.
 */
@Component
public class LeadResponseMapper {

    private final LeadScoringService leadScoringService;

    public LeadResponseMapper(LeadScoringService leadScoringService) {
        this.leadScoringService = leadScoringService;
    }

    public LeadResponse toResponse(Lead lead) {
        LeadScoringService.ScoreBreakdown b =
            leadScoringService.breakdown(lead.getBudgetRange(), lead.getEventType(), lead.getEventDate());
        return new LeadResponse(
            lead.getId(),
            lead.getName(),
            lead.getEmail(),
            lead.getPhone(),
            lead.getEventDate(),
            lead.getEventType(),
            lead.getBudgetRange(),
            lead.getMessage(),
            lead.getInternalNotes(),
            lead.getScore(),
            b.budget(),
            b.type(),
            b.time(),
            lead.getStatus().name(),
            lead.getSource(),
            lead.getIgMessageId(),
            lead.getIgUsername(),
            lead.getCreatedAt()
        );
    }
}
