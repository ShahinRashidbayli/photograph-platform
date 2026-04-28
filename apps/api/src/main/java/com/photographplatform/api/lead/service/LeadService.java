package com.photographplatform.api.lead.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.dto.CreateLeadRequest;
import com.photographplatform.api.lead.dto.LeadResponse;
import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.lead.repository.LeadRepository;
import com.photographplatform.api.tenant.domain.Tenant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LeadService {

    private final LeadRepository leadRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final AuditService auditService;

    public LeadService(LeadRepository leadRepository, ApplicationEventPublisher eventPublisher,
                       AuditService auditService) {
        this.leadRepository = leadRepository;
        this.eventPublisher = eventPublisher;
        this.auditService = auditService;
    }

    @Transactional
    public LeadResponse createLead(CreateLeadRequest req, Tenant tenant, String ipAddress) {
        String score = calculateScore(req);

        Lead lead = new Lead(
            req.name(),
            req.email(),
            req.phone(),
            req.eventDate(),
            req.eventType(),
            req.budgetRange(),
            req.message(),
            ipAddress
        );
        lead.setScore(score);

        Lead saved = leadRepository.save(lead);

        auditService.log("LEAD_CREATED", "LEAD", saved.getId(), tenant.getId(),
            UUID.randomUUID(), ipAddress);

        eventPublisher.publishEvent(
            new LeadCreatedEvent(this, saved.getId(), req.name(), req.email(), score,
                tenant.getSubdomain(), tenant.getOwnerEmail())
        );

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public java.util.List<LeadResponse> getLeads(String score, String status, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        if (score != null && status != null) {
            return leadRepository.findByScoreAndStatus(score, status, pageable)
                .stream()
                .map(this::toResponse)
                .toList();
        } else if (score != null) {
            return leadRepository.findByScore(score, pageable)
                .stream()
                .map(this::toResponse)
                .toList();
        } else if (status != null) {
            return leadRepository.findByStatus(status, pageable)
                .stream()
                .map(this::toResponse)
                .toList();
        } else {
            return leadRepository.findAll(pageable)
                .stream()
                .map(this::toResponse)
                .toList();
        }
    }

    @Transactional(readOnly = true)
    public java.util.List<LeadResponse> getRecentLeads(int limit) {
        return leadRepository.findAll(PageRequest.of(0, limit, Sort.by("createdAt").descending()))
            .stream()
            .map(this::toResponse)
            .toList();
    }

    private String calculateScore(CreateLeadRequest req) {
        boolean highBudget = "500_1000".equals(req.budgetRange()) || "OVER_1000".equals(req.budgetRange());
        boolean farDate = req.eventDate() != null &&
            ChronoUnit.DAYS.between(LocalDate.now(), req.eventDate()) > 60;
        boolean highValueType = "WEDDING".equals(req.eventType()) || "ENGAGEMENT".equals(req.eventType());

        if (highBudget && farDate && highValueType) {
            return "HIGH";
        }

        boolean medBudget = "200_500".equals(req.budgetRange());
        boolean medDate = req.eventDate() != null &&
            ChronoUnit.DAYS.between(LocalDate.now(), req.eventDate()) >= 30;

        if (medBudget || medDate) {
            return "MED";
        }

        return "LOW";
    }

    private LeadResponse toResponse(Lead lead) {
        return new LeadResponse(
            lead.getId(),
            lead.getName(),
            lead.getEmail(),
            lead.getPhone(),
            lead.getEventDate(),
            lead.getEventType(),
            lead.getBudgetRange(),
            lead.getMessage(),
            lead.getScore(),
            lead.getStatus(),
            lead.getCreatedAt()
        );
    }
}
