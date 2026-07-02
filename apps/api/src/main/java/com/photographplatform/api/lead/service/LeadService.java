package com.photographplatform.api.lead.service;

import com.photographplatform.api.audit.dto.AuditLogResponse;
import com.photographplatform.api.audit.repository.AuditLogRepository;
import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.service.BookingService;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.dto.ConvertLeadRequest;
import com.photographplatform.api.lead.dto.CreateLeadRequest;
import com.photographplatform.api.lead.dto.LeadResponse;
import com.photographplatform.api.lead.dto.UpdateLeadRequest;
import com.photographplatform.api.lead.event.LeadCreatedEvent;
import com.photographplatform.api.lead.repository.LeadRepository;
import com.photographplatform.api.tenant.domain.Tenant;
import java.util.List;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LeadService {

    private static final String LEAD_STATUS_BOOKED = "BOOKED";

    private final LeadRepository leadRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final AuditService auditService;
    private final BookingService bookingService;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;

    public LeadService(LeadRepository leadRepository, ApplicationEventPublisher eventPublisher,
                       AuditService auditService, BookingService bookingService,
                       UserRepository userRepository, AuditLogRepository auditLogRepository) {
        this.leadRepository = leadRepository;
        this.eventPublisher = eventPublisher;
        this.auditService = auditService;
        this.bookingService = bookingService;
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
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

        if ("REJECTED".equalsIgnoreCase(lead.getStatus())) {
            return toResponse(lead);
        }
        if (LEAD_STATUS_BOOKED.equalsIgnoreCase(lead.getStatus())) {
            throw new ConflictException(
                "Cannot reject a lead that has been converted to a booking"
            );
        }

        String previousStatus = lead.getStatus();
        lead.setStatus("REJECTED");
        leadRepository.save(lead);

        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        auditService.log(
            "LEAD_REJECTED",
            "LEAD",
            lead.getId(),
            tenantId,
            actorId,
            ipAddress,
            previousStatus,
            "REJECTED"
        );

        return toResponse(lead);
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

        if (LEAD_STATUS_BOOKED.equalsIgnoreCase(lead.getStatus())
            || "REJECTED".equalsIgnoreCase(lead.getStatus())) {
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
            return toResponse(lead);
        }

        lead.setName(req.name().trim());
        lead.setEmail(req.email().trim().toLowerCase());
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
        auditService.log(
            "LEAD_UPDATED",
            "LEAD",
            lead.getId(),
            tenantId,
            actorId,
            ipAddress,
            null,
            changedFields.toString()
        );

        return toResponse(lead);
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

        String current = lead.getStatus();
        if ("REPLIED".equalsIgnoreCase(current)) {
            return toResponse(lead);
        }
        if (LEAD_STATUS_BOOKED.equalsIgnoreCase(current) || "REJECTED".equalsIgnoreCase(current)) {
            throw new ConflictException(
                "Cannot mark a " + current + " lead as REPLIED — it's already in a terminal state."
            );
        }

        lead.setStatus("REPLIED");
        leadRepository.save(lead);

        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        auditService.log(
            "LEAD_REPLIED",
            "LEAD",
            lead.getId(),
            tenantId,
            actorId,
            ipAddress,
            current,
            "REPLIED"
        );

        return toResponse(lead);
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
        lead.setScore(score);
        Lead saved = leadRepository.save(lead);

        auditService.log("LEAD_CREATED", "LEAD", saved.getId(), tenantId, actorId, ipAddress);

        // No tenant lookup here (we have the actor's tenant id directly); the
        // event publisher is left in place so notification flows that listen
        // for new leads (email-the-photographer, etc.) still fire.
        // The subdomain/ownerEmail args aren't strictly needed for a manual
        // add but keep the event payload shape consistent with the public path.
        eventPublisher.publishEvent(
            new LeadCreatedEvent(this, saved.getId(), req.name(), req.email(), score,
                null, actor.getEmail())
        );

        return toResponse(saved);
    }

    /**
     * Stream every lead in this tenant as CSV. Tenant scoping is handled by
     * the routing data source (search_path is set per request from the JWT).
     *
     * <p>Writes directly to the response OutputStream so the file size is
     * bounded by network throughput, not by JVM heap — even a tenant with
     * tens of thousands of leads stays well-behaved. Header row first, then
     * one row per lead.
     *
     * <p>CSV escaping per RFC 4180: any field containing a quote, comma, or
     * newline is wrapped in double-quotes; inner quotes are doubled.
     */
    @Transactional(readOnly = true)
    public void exportCsv(java.io.OutputStream out) throws java.io.IOException {
        java.io.OutputStreamWriter w = new java.io.OutputStreamWriter(out, java.nio.charset.StandardCharsets.UTF_8);
        w.write("id,name,email,phone,event_date,event_type,budget_range,score,status,created_at\n");
        for (Lead lead : leadRepository.findAll(Sort.by("createdAt").descending())) {
            w.write(csvEscape(lead.getId() == null ? "" : lead.getId().toString()));
            w.write(',');
            w.write(csvEscape(lead.getName()));
            w.write(',');
            w.write(csvEscape(lead.getEmail()));
            w.write(',');
            w.write(csvEscape(lead.getPhone()));
            w.write(',');
            w.write(csvEscape(lead.getEventDate() == null ? "" : lead.getEventDate().toString()));
            w.write(',');
            w.write(csvEscape(lead.getEventType()));
            w.write(',');
            w.write(csvEscape(lead.getBudgetRange()));
            w.write(',');
            w.write(csvEscape(lead.getScore()));
            w.write(',');
            w.write(csvEscape(lead.getStatus()));
            w.write(',');
            w.write(csvEscape(lead.getCreatedAt() == null ? "" : lead.getCreatedAt().toString()));
            w.write('\n');
        }
        w.flush();
    }

    private static String csvEscape(String value) {
        if (value == null) {
            return "";
        }
        boolean needsQuote = value.indexOf(',') >= 0
            || value.indexOf('"') >= 0
            || value.indexOf('\n') >= 0
            || value.indexOf('\r') >= 0;
        if (!needsQuote) {
            return value;
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    /**
     * Activity timeline for a single lead — backs the right-panel "Activity"
     * section. Reads from {@code audit_log} filtered to this lead, ordered
     * newest first.
     *
     * <p>Filtered by tenant id as well as entity id: audit_log lives in the
     * public schema (not the tenant search_path), so entity_id alone is not
     * enough to guarantee isolation. UUIDs are unguessable in practice but
     * defence-in-depth still requires the tenant filter.
     *
     * <p>404s if the lead isn't visible in this tenant — surfacing activity
     * for a lead that doesn't exist in scope would leak the existence of an
     * id outside the photographer's tenant.
     */
    @Transactional(readOnly = true)
    public List<AuditLogResponse> getActivity(UUID leadId) {
        // Existence check: leadRepository is tenant-scoped via the routing
        // data source, so a missing lead here means "not visible to this
        // tenant" — surface as 404 rather than returning an empty timeline.
        Lead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new NotFoundException("Lead not found: " + leadId));

        UUID tenantId = SecurityUtils.requireCurrentTenantId();

        return auditLogRepository
            .findByTenantIdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(tenantId, "LEAD", lead.getId())
            .stream()
            .map(LeadService::toAuditResponse)
            .toList();
    }

    private static AuditLogResponse toAuditResponse(com.photographplatform.api.audit.domain.AuditLog row) {
        return new AuditLogResponse(
            row.getId(),
            row.getAction(),
            row.getEntityType(),
            row.getEntityId(),
            row.getOldValue(),
            row.getNewValue(),
            row.getActorId(),
            row.getCreatedAt()
        );
    }

    /**
     * Convert a lead into a booking. The booking inherits the lead's contact
     * info, event date and type; the photographer supplies the remaining
     * operational fields (time, location, pricing) via {@link ConvertLeadRequest}.
     *
     * <p>Idempotent on the lead side: a second convert call against a lead that
     * is already {@code BOOKED} returns HTTP 409 rather than silently producing
     * a duplicate booking. Booking creation and the lead status flip happen in
     * the same transaction so a failure midway never leaves the lead
     * advertising "BOOKED" without a matching booking row.
     */
    @Transactional
    public BookingResponse convertLead(UUID leadId, ConvertLeadRequest overrides, String ipAddress) {
        Lead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new NotFoundException("Lead not found: " + leadId));

        if (LEAD_STATUS_BOOKED.equalsIgnoreCase(lead.getStatus())) {
            throw new ConflictException("Lead already converted: " + leadId);
        }

        BookingResponse booking = bookingService.createFromLead(lead, overrides, ipAddress);

        String previousStatus = lead.getStatus();
        lead.setStatus(LEAD_STATUS_BOOKED);
        leadRepository.save(lead);

        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        auditService.log(
            "LEAD_CONVERTED",
            "LEAD",
            lead.getId(),
            tenantId,
            actorId,
            ipAddress,
            previousStatus,
            LEAD_STATUS_BOOKED
        );

        return booking;
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

        Page<Lead> result;
        if (score != null && status != null) {
            result = leadRepository.findByScoreAndStatus(score, status, pageable);
        } else if (score != null) {
            result = leadRepository.findByScore(score, pageable);
        } else if (status != null) {
            result = leadRepository.findByStatus(status, pageable);
        } else {
            result = leadRepository.findAll(pageable);
        }
        return result.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public java.util.List<LeadResponse> getRecentLeads(int limit) {
        return leadRepository.findAll(PageRequest.of(0, limit, Sort.by("createdAt").descending()))
            .stream()
            .map(this::toResponse)
            .toList();
    }

    /**
     * Component scoring on a 0–100 scale, used to render the breakdown bars
     * in the lead detail panel. Kept as a private helper so the same logic
     * powers both the rollup ({@link #calculateScore}) and the breakdown
     * surfaced in {@link LeadResponse}.
     *
     * <p>Scales chosen to match the spec's qualitative bands:
     * <ul>
     *   <li><b>Budget</b>: 30 / 60 / 90 / 100 for under-€200 / €200–500 /
     *       €500–1000 / over-€1000. Steep climb at €500 mirrors the rollup's
     *       "high budget" cutoff.</li>
     *   <li><b>Type</b>: 100 wedding/engagement, 70 portrait/family/newborn,
     *       60 corporate, 50 anything else. Premium event types are the
     *       single biggest revenue lever.</li>
     *   <li><b>Time</b>: 100 (&gt;60d), 70 (30–60d), 40 (&lt;30d), 10 (past).
     *       Lead time matters because rushed bookings are riskier to plan and
     *       price.</li>
     * </ul>
     */
    private record ScoreBreakdown(int budget, int type, int time) {}

    private static ScoreBreakdown scoreBreakdown(String budgetRange, String eventType, LocalDate eventDate) {
        int budget = switch (budgetRange == null ? "" : budgetRange) {
            case "OVER_1000" -> 100;
            case "500_1000" -> 90;
            case "200_500" -> 60;
            case "UNDER_200" -> 30;
            default -> 50;
        };
        int type = switch (eventType == null ? "" : eventType) {
            case "WEDDING", "ENGAGEMENT" -> 100;
            case "PORTRAIT", "FAMILY", "NEWBORN" -> 70;
            case "CORPORATE" -> 60;
            default -> 50;
        };
        int time;
        if (eventDate == null) {
            time = 50; // no date supplied — assume neutral
        } else {
            long days = ChronoUnit.DAYS.between(LocalDate.now(), eventDate);
            if (days < 0) {
                time = 10;
            } else if (days < 30) {
                time = 40;
            } else if (days <= 60) {
                time = 70;
            } else {
                time = 100;
            }
        }
        return new ScoreBreakdown(budget, type, time);
    }

    private String calculateScore(CreateLeadRequest req) {
        ScoreBreakdown b = scoreBreakdown(req.budgetRange(), req.eventType(), req.eventDate());
        // Rollup mirrors the original thresholds: HIGH = all three components
        // strong; MED = budget mid-tier OR date at least 30 days out; else LOW.
        // Keeping the rollup independent of an arithmetic mean ensures the
        // existing HIGH/MED/LOW behaviour doesn't drift as we tune component
        // scoring.
        if (b.budget() >= 90 && b.type() == 100 && b.time() == 100) {
            return "HIGH";
        }
        if (b.budget() == 60 || b.time() >= 70) {
            return "MED";
        }
        return "LOW";
    }

    private LeadResponse toResponse(Lead lead) {
        ScoreBreakdown b = scoreBreakdown(lead.getBudgetRange(), lead.getEventType(), lead.getEventDate());
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
            lead.getStatus(),
            lead.getSource(),
            lead.getIgMessageId(),
            lead.getIgUsername(),
            lead.getCreatedAt()
        );
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
            return toResponse(lead);
        }

        lead.setInternalNotes(normalized);
        leadRepository.save(lead);

        UUID actorId = SecurityUtils.requireCurrentUserId();
        UUID tenantId = SecurityUtils.currentTenantId();
        // Audit captures *what changed*, not the full note bodies — long notes
        // would bloat the audit table and an audit row's purpose is "when /
        // who", not "what was the prose". The flag pair makes it easy to
        // reconstruct the lifecycle.
        auditService.log(
            "LEAD_NOTES_UPDATED",
            "LEAD",
            lead.getId(),
            tenantId,
            actorId,
            ipAddress,
            previous == null ? "empty" : "present",
            normalized == null ? "empty" : "present"
        );

        return toResponse(lead);
    }
}
