package com.photographplatform.api.lead.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.common.util.Paging;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.domain.LeadScore;
import com.photographplatform.api.lead.domain.LeadStatus;
import com.photographplatform.api.lead.dto.CreateLeadRequest;
import com.photographplatform.api.lead.dto.LeadResponse;
import com.photographplatform.api.lead.dto.UpdateLeadRequest;
import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.lead.repository.LeadRepository;
import com.photographplatform.api.tenant.domain.Tenant;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LeadService {

    /**
     * Actor recorded on the audit row for a lead submitted through the public
     * form. There is no authenticated user on that path, and the previous
     * {@code UUID.randomUUID()} minted a fresh, meaningless id per submission
     * — indistinguishable from a real user id to anyone reading the trail, and
     * impossible to filter or group by. A single stable sentinel says "public
     * form, no actor" honestly and makes those rows queryable as a set.
     */
    public static final UUID ANONYMOUS_ACTOR_ID =
        UUID.fromString("00000000-0000-0000-0000-000000000000");

    /**
     * Ordered by {@code createdAt}, then by id.
     *
     * <p>The tie-breaker is not decoration. Postgres promises no order among
     * rows a sort cannot separate, and a studio's bookings cluster hard on a
     * date — a Saturday in June is not two bookings, it is twenty. Without a
     * second key the same row can appear on two pages and another on none,
     * which the clients here read as duplicated and missing bookings rather
     * than as an unstable sort.
     */
    private static final Sort NEWEST_FIRST =
        Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    private final LeadRepository leadRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final AuditService auditService;
    private final UserRepository userRepository;
    private final LeadScoringService leadScoringService;
    private final LeadResponseMapper mapper;

    public LeadService(LeadRepository leadRepository, ApplicationEventPublisher eventPublisher,
                       AuditService auditService, UserRepository userRepository,
                       LeadScoringService leadScoringService, LeadResponseMapper mapper) {
        this.leadRepository = leadRepository;
        this.eventPublisher = eventPublisher;
        this.auditService = auditService;
        this.userRepository = userRepository;
        this.leadScoringService = leadScoringService;
        this.mapper = mapper;
    }

    /**
     * Transition a lead to REJECTED. The only status flip the photographer
     * UI offers today (other than BOOKED, which goes through {@link
     * #convertLead}). Disallows REJECTED from a BOOKED lead — once it's
     * become a booking the lead is effectively terminal, and "rejecting" it
     * would put the lead row out of sync with the booking row.
     *
     * <p>Idempotent: rejecting an already-REJECTED lead is a no-op success
     * (no second audit row) rather than a 409, so a retried request from a
     * flaky network doesn't surface a confusing conflict error.
     */
    @Transactional
    public LeadResponse rejectLead(UUID leadId, String ipAddress) {
        Lead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new NotFoundException("Lead not found: " + leadId));

        LeadStatus previousStatus = lead.getStatus();
        if (previousStatus == LeadStatus.REJECTED) {
            return mapper.toResponse(lead);
        }
        previousStatus.assertCanTransitionTo(LeadStatus.REJECTED);

        lead.setStatus(LeadStatus.REJECTED);
        leadRepository.save(lead);

        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        auditService.logChange(
            "LEAD_REJECTED",
            "LEAD",
            lead.getId(),
            tenantId,
            actorId,
            ipAddress,
            previousStatus.name(),
            LeadStatus.REJECTED.name()
        );

        return mapper.toResponse(lead);
    }

    /**
     * Update editable fields on an existing lead — used by the photographer
     * to correct intake mistakes (typo in email, wrong event date,
     * miscaptured event type). The audit row carries the *names* of the
     * fields that changed, not their old/new values, because dragging full
     * names/emails into audit_log bloats the table and risks leaking PII
     * into a less-protected surface.
     *
     * <p>Score is recomputed from the new inputs and overwritten — editing
     * budget/type/eventDate is precisely when the score should change, and
     * silently leaving the old score would make the score breakdown lie.
     */
    @Transactional
    public LeadResponse updateLead(UUID leadId, UpdateLeadRequest req, String ipAddress) {
        Lead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new NotFoundException("Lead not found: " + leadId));

        if (lead.getStatus().isTerminal()) {
            // Editing a terminal-state lead would put its facts out of sync
            // with the booking it spawned (or the rejection reason in the
            // photographer's head). Force the photographer to either undo
            // the terminal transition (not currently supported) or just
            // accept the lead-as-recorded.
            throw new ConflictException(
                "Cannot edit a " + lead.getStatus() + " lead — it's in a terminal state."
            );
        }

        StringBuilder changedFields = new StringBuilder();
        if (!safeEq(lead.getName(), req.name())) {
            appendField(changedFields, "name");
        }
        if (!safeEq(lead.getEmail(), req.email())) {
            appendField(changedFields, "email");
        }
        if (!safeEq(lead.getPhone(), req.phone())) {
            appendField(changedFields, "phone");
        }
        if (!safeEq(
            lead.getEventDate() == null ? null : lead.getEventDate().toString(),
            req.eventDate() == null ? null : req.eventDate().toString()
        )) {
            appendField(changedFields, "eventDate");
        }
        if (!safeEq(lead.getEventType(), req.eventType())) {
            appendField(changedFields, "eventType");
        }
        if (!safeEq(lead.getBudgetRange(), req.budgetRange())) {
            appendField(changedFields, "budgetRange");
        }
        if (!safeEq(lead.getMessage(), req.message())) {
            appendField(changedFields, "message");
        }

        // Idempotency: no fields actually changed → no-op success, no audit row.
        if (changedFields.length() == 0) {
            return mapper.toResponse(lead);
        }

        lead.setName(req.name().trim());
        lead.setEmail(Normalize.email(req.email()));
        lead.setPhone(req.phone() == null || req.phone().isBlank() ? null : req.phone().trim());
        lead.setEventDate(req.eventDate());
        lead.setEventType(req.eventType().trim());
        lead.setBudgetRange(req.budgetRange().trim());
        lead.setMessage(req.message() == null || req.message().isBlank() ? null : req.message().trim());

        // Re-score: editing the inputs that feed scoring should update the
        // outputs, otherwise the score breakdown bars would lie about the
        // current data.
        CreateLeadRequest forScoring = new CreateLeadRequest(
            req.name(), req.email(), req.phone(), req.eventDate(),
            req.eventType(), req.budgetRange(), req.message(), null
        );
        lead.setScore(calculateScore(forScoring));

        leadRepository.save(lead);

        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        auditService.logChange(
            "LEAD_UPDATED",
            "LEAD",
            lead.getId(),
            tenantId,
            actorId,
            ipAddress,
            null,
            changedFields.toString()
        );

        return mapper.toResponse(lead);
    }

    private static boolean safeEq(String a, String b) {
        String na = a == null ? "" : a.trim();
        String nb = b == null ? "" : b.trim();
        return na.equals(nb);
    }

    private static void appendField(StringBuilder sb, String field) {
        if (sb.length() > 0) {
            sb.append(',');
        }
        sb.append(field);
    }

    /**
     * Mark a lead as REPLIED. Used by the "Mark as replied" affordance on the
     * detail panel so the "N enquiries awaiting your reply" alert in the
     * leads header actually clears once the photographer has responded
     * off-platform (WhatsApp, email outside the platform, phone call).
     *
     * <p>Without this transition the alert lies — every lead in NEW status
     * counts as "awaiting reply" forever, even if the photographer has
     * already replied.
     *
     * <p>Idempotent: re-marking an already-REPLIED lead is a no-op (no
     * second audit row). Disallows the transition from any terminal status
     * (BOOKED, REJECTED) — those are end states, "replied" isn't a
     * meaningful regression.
     */
    @Transactional
    public LeadResponse markReplied(UUID leadId, String ipAddress) {
        Lead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new NotFoundException("Lead not found: " + leadId));

        LeadStatus current = lead.getStatus();
        if (current == LeadStatus.REPLIED) {
            return mapper.toResponse(lead);
        }
        current.assertCanTransitionTo(LeadStatus.REPLIED);

        lead.setStatus(LeadStatus.REPLIED);
        leadRepository.save(lead);

        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        auditService.logChange(
            "LEAD_REPLIED",
            "LEAD",
            lead.getId(),
            tenantId,
            actorId,
            ipAddress,
            current.name(),
            LeadStatus.REPLIED.name()
        );

        return mapper.toResponse(lead);
    }

    /**
     * Create a lead on behalf of the authenticated photographer — used for
     * enquiries that came in off-platform (phone, WhatsApp, walk-in). Skips
     * the honeypot and IP rate-limit applied to the public submission path
     * since the photographer is trusted; otherwise behaves identically:
     * compute score, persist, audit, fire the event.
     *
     * <p>Actor on the audit row is the real photographer (not a synthetic
     * UUID like the public form's anonymous submission), so this entry is
     * distinguishable in the audit trail as photographer-originated.
     */
    @Transactional
    public LeadResponse createLeadByPhotographer(CreateLeadRequest req, String ipAddress) {
        UUID actorId = SecurityUtils.requireCurrentUserId();
        User actor = userRepository.findById(actorId)
            .orElseThrow(() -> new UnauthorizedException("Authentication required"));
        UUID tenantId = actor.getTenantId();

        String score = calculateScore(req);
        Lead lead = new Lead(
            req.name(), req.email(), req.phone(), req.eventDate(), req.eventType(),
            req.budgetRange(), req.message(), ipAddress
        );
        lead.setTenantId(tenantId);
        lead.setScore(score);
        Lead saved = leadRepository.save(lead);

        auditService.log("LEAD_CREATED", "LEAD", saved.getId(), tenantId, actorId, ipAddress);

        // Still published, so anything that reacts to new leads sees this one.
        // ENTERED_BY_STUDIO tells the email listeners to stay quiet: the
        // Customer already talked to the studio, and the person who typed the
        // lead does not need an alert about it (#103).
        eventPublisher.publishEvent(
            new LeadCreatedEvent(this, saved.getId(), tenantId, req.name(), req.email(), score,
                LeadCreatedEvent.Origin.ENTERED_BY_STUDIO, null, actor.getEmail())
        );

        return mapper.toResponse(saved);
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
        lead.setTenantId(tenant.getId());
        lead.setScore(score);

        Lead saved = leadRepository.save(lead);

        auditService.log("LEAD_CREATED", "LEAD", saved.getId(), tenant.getId(),
            ANONYMOUS_ACTOR_ID, ipAddress);

        eventPublisher.publishEvent(
            new LeadCreatedEvent(this, saved.getId(), tenant.getId(), req.name(), req.email(), score,
                LeadCreatedEvent.Origin.PUBLIC_FORM, studioName(tenant), tenant.getOwnerEmail())
        );

        return mapper.toResponse(saved);
    }

    /**
     * The photographer's lead list, optionally filtered by score and status.
     *
     * <p>Both filters are parsed rather than passed through. An unrecognised
     * value used to reach the repository verbatim and match nothing, so {@code
     * ?score=HIGHH} and "you have no high-scoring leads" were the same
     * response — and the caller had no way to tell a typo from an empty
     * pipeline.
     */
    @Transactional(readOnly = true)
    public List<LeadResponse> getLeads(String score, String status, int page, int size) {
        Pageable pageable = Paging.of(page, size, NEWEST_FIRST);
        String parsedScore = score == null || score.isBlank() ? null : LeadScore.parse(score).name();
        String parsedStatus = status == null || status.isBlank() ? null : LeadStatus.parse(status).name();

        Slice<Lead> result;
        if (parsedScore != null && parsedStatus != null) {
            result = leadRepository.findByScoreAndStatus(parsedScore, parsedStatus, pageable);
        } else if (parsedScore != null) {
            result = leadRepository.findByScore(parsedScore, pageable);
        } else if (parsedStatus != null) {
            result = leadRepository.findByStatus(parsedStatus, pageable);
        } else {
            result = leadRepository.findAllBy(pageable);
        }
        return result.stream().map(mapper::toResponse).toList();
    }

    /**
     * The dashboard's "latest leads" strip. {@code limit} goes through the same
     * bound as a page size — it is the same thing under another name, and
     * nothing stopped {@code ?limit=100000} before.
     */
    @Transactional(readOnly = true)
    public List<LeadResponse> getRecentLeads(int limit) {
        return leadRepository.findAllBy(Paging.of(0, limit, NEWEST_FIRST))
            .stream()
            .map(mapper::toResponse)
            .toList();
    }

    /**
     * The name a Customer knows the studio by: its business name, else its legal
     * name, else none. Never the subdomain: the acknowledgement used to sign
     * "Qa Pipe 11251358" for a studio at qa-pipe-11251358 (#103).
     */
    private static String studioName(Tenant tenant) {
        if (tenant.getBusinessName() != null && !tenant.getBusinessName().isBlank()) {
            return tenant.getBusinessName().trim();
        }
        if (tenant.getLegalName() != null && !tenant.getLegalName().isBlank()) {
            return tenant.getLegalName().trim();
        }
        return null;
    }

    private String calculateScore(CreateLeadRequest req) {
        return leadScoringService.rollup(req.budgetRange(), req.eventType(), req.eventDate());
    }

    /**
     * Update the photographer-only internal notes on a lead. Null or blank
     * input clears the field (both surface the same intent — "no note here").
     * Idempotent: re-writing the same value emits an audit row only when the
     * value actually changed, so a duplicate save from a double-click doesn't
     * pollute the trail.
     */
    @Transactional
    public LeadResponse updateNotes(UUID leadId, String notes, String ipAddress) {
        Lead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new NotFoundException("Lead not found: " + leadId));

        String normalized = (notes == null || notes.isBlank()) ? null : notes.trim();
        String previous = lead.getInternalNotes();
        boolean unchanged = (previous == null && normalized == null)
            || (previous != null && previous.equals(normalized));
        if (unchanged) {
            return mapper.toResponse(lead);
        }

        lead.setInternalNotes(normalized);
        leadRepository.save(lead);

        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        // Audit captures *what changed*, not the full note bodies — long notes
        // would bloat the audit table and an audit row's purpose is "when /
        // who", not "what was the prose". The flag pair makes it easy to
        // reconstruct the lifecycle.
        auditService.logChange(
            "LEAD_NOTES_UPDATED",
            "LEAD",
            lead.getId(),
            tenantId,
            actorId,
            ipAddress,
            previous == null ? "empty" : "present",
            normalized == null ? "empty" : "present"
        );

        return mapper.toResponse(lead);
    }
}
