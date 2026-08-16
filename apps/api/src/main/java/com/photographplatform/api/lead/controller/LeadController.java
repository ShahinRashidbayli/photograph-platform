package com.photographplatform.api.lead.controller;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.audit.dto.AuditLogResponse;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.TooManyRequestsException;
import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.common.security.RequiresVerifiedEmail;
import com.photographplatform.api.lead.domain.LeadStatus;
import com.photographplatform.api.lead.dto.ConvertLeadRequest;
import com.photographplatform.api.lead.dto.CreateLeadRequest;
import com.photographplatform.api.lead.dto.LeadResponse;
import com.photographplatform.api.lead.dto.UpdateLeadNotesRequest;
import com.photographplatform.api.lead.dto.UpdateLeadRequest;
import com.photographplatform.api.lead.dto.UpdateLeadStatusRequest;
import com.photographplatform.api.lead.service.LeadConversionService;
import com.photographplatform.api.lead.service.LeadReportingService;
import com.photographplatform.api.lead.service.LeadService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class LeadController {

    private static final int RATE_LIMIT_MAX_REQUESTS = 3;
    private static final Duration RATE_LIMIT_WINDOW = Duration.ofMinutes(5);

    private final LeadService leadService;
    private final LeadConversionService leadConversionService;
    private final LeadReportingService leadReportingService;
    private final TenantRepository tenantRepository;
    private final StringRedisTemplate redisTemplate;

    public LeadController(LeadService leadService,
                          LeadConversionService leadConversionService,
                          LeadReportingService leadReportingService,
                          TenantRepository tenantRepository,
                          StringRedisTemplate redisTemplate) {
        this.leadService = leadService;
        this.leadConversionService = leadConversionService;
        this.leadReportingService = leadReportingService;
        this.tenantRepository = tenantRepository;
        this.redisTemplate = redisTemplate;
    }

    @PostMapping("/public/leads/{subdomain}")
    public ResponseEntity<LeadResponse> createLead(
        @PathVariable String subdomain,
        @Valid @RequestBody CreateLeadRequest request,
        HttpServletRequest httpRequest
    ) {
        String ip = ClientIp.from(httpRequest);

        // Honeypot: silently accept (HTTP 202) without persisting. Returning a
        // success status keeps the bot from retrying or pivoting tactics, while
        // we don't burn a rate-limit slot or DB row on the abuse.
        if (request.isHoneypotTriggered()) {
            return ResponseEntity.accepted().build();
        }

        checkRateLimit(ip);

        Tenant tenant = tenantRepository.findBySubdomain(subdomain)
            .orElseThrow(() -> new NotFoundException("Photographer not found: " + subdomain));

        TenantContext.setTenant(tenant.getId().toString());
        try {
            LeadResponse response = leadService.createLead(request, tenant, ip);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * Convert a lead into a booking. The booking inherits the lead's contact
     * info, event date and event type; the body carries operational overrides
     * (time, location, pricing) the photographer fills in during the call.
     *
     * <p>Returns 201 with the new {@link BookingResponse}. 404 if the lead is
     * unknown in this tenant, 409 if the lead is already converted.
     *
     * <p>Email-verification gated: conversion triggers downstream client emails
     * (deposit request, contract), which must not go out under an unverified
     * photographer identity. {@code /api/leads/**} is already role-gated to
     * PHOTOGRAPHER/ADMIN in {@code SecurityConfig}.
     */
    @RequiresVerifiedEmail
    @PostMapping("/leads/{id}/convert")
    public ResponseEntity<BookingResponse> convertLead(
        @PathVariable UUID id,
        @Valid @RequestBody ConvertLeadRequest request,
        HttpServletRequest httpRequest
    ) {
        BookingResponse booking = leadConversionService.convertLead(id, request, ClientIp.from(httpRequest));
        return ResponseEntity.status(HttpStatus.CREATED).body(booking);
    }

    /**
     * Manual lead entry by the authenticated photographer. Used for enquiries
     * that arrived off-platform (phone, WhatsApp, walk-in). Distinct from the
     * public form ({@code POST /api/public/leads/{subdomain}}) — no honeypot,
     * no IP rate limit, and the audit actor is the photographer rather than
     * a synthetic anonymous UUID.
     *
     * <p>Email-verification gated: a new lead can trigger downstream client
     * notifications, which shouldn't go out under an unverified identity.
     */
    @RequiresVerifiedEmail
    @PostMapping("/leads")
    public ResponseEntity<LeadResponse> createLeadManually(
        @Valid @RequestBody CreateLeadRequest request,
        HttpServletRequest httpRequest
    ) {
        LeadResponse created = leadService.createLeadByPhotographer(request, ClientIp.from(httpRequest));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Status transition for a lead. Today the UI only exposes REJECTED here
     * (the BOOKED transition lives at {@code POST /api/leads/{id}/convert}
     * because it produces a booking row as a side effect). Other status
     * values are accepted by the schema's CHECK constraint but will be
     * rejected with a 4xx by the service if they're unsupported.
     *
     * <p>Email-verification gated for the same reason as convert: status
     * changes drive notifications.
     */
    @RequiresVerifiedEmail
    @PatchMapping("/leads/{id}/status")
    public ResponseEntity<LeadResponse> updateStatus(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateLeadStatusRequest request,
        HttpServletRequest httpRequest
    ) {
        // Each supported transition routes to a purpose-built service method
        // so the audit trail carries a transition-specific action
        // (LEAD_REPLIED vs LEAD_REJECTED), not a generic "status changed".
        // BOOKED is intentionally NOT accepted here — it has its own
        // /convert endpoint that also creates the booking row.
        String ip = ClientIp.from(httpRequest);
        return switch (LeadStatus.parse(request.status())) {
            case REPLIED -> ResponseEntity.ok(leadService.markReplied(id, ip));
            case REJECTED -> ResponseEntity.ok(leadService.rejectLead(id, ip));
            case NEW, BOOKED -> throw new ConflictException(
                "Unsupported status transition: " + request.status());
        };
    }

    /**
     * Update editable fields on an existing lead — name, email, phone,
     * event date/type, budget range, message. The {@code internalNotes} and
     * {@code status} fields are intentionally excluded from this surface;
     * each has its own purpose-built route so the audit trail can carry a
     * specific action code per intent.
     *
     * <p>Email-verification gated like every other lead mutation.
     */
    @RequiresVerifiedEmail
    @PatchMapping("/leads/{id}")
    public ResponseEntity<LeadResponse> updateLead(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateLeadRequest request,
        HttpServletRequest httpRequest
    ) {
        LeadResponse updated = leadService.updateLead(id, request, ClientIp.from(httpRequest));
        return ResponseEntity.ok(updated);
    }

    /**
     * Update the photographer-only internal notes on a lead. Distinct route
     * from the status PATCH so the audit trail can carry a separate action
     * code ({@code LEAD_NOTES_UPDATED}) without mixing two different intents
     * on one endpoint.
     *
     * <p>Email-verification gated like the other photographer mutations.
     */
    @RequiresVerifiedEmail
    @PatchMapping("/leads/{id}/notes")
    public ResponseEntity<LeadResponse> updateNotes(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateLeadNotesRequest request,
        HttpServletRequest httpRequest
    ) {
        LeadResponse updated = leadService.updateNotes(id, request.notes(), ClientIp.from(httpRequest));
        return ResponseEntity.ok(updated);
    }

    /**
     * CSV export of every lead in the tenant. Streams directly to the
     * response so memory use is bounded by network throughput, not heap.
     * Filename embeds the date so successive downloads don't overwrite each
     * other on the photographer's machine.
     */
    @GetMapping("/leads/export.csv")
    public void exportCsv(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.OK.value());
        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader(
            "Content-Disposition",
            "attachment; filename=\"leads-" + LocalDate.now() + ".csv\""
        );
        leadReportingService.exportCsv(response.getOutputStream());
    }

    /**
     * Activity timeline for a single lead — backs the detail panel's Activity
     * section. Returns audit-log entries (LEAD_CREATED, LEAD_CONVERTED, …)
     * scoped to this tenant and entity, newest first.
     *
     * <p>{@code /api/leads/**} is already role-gated to PHOTOGRAPHER/ADMIN
     * by {@code SecurityConfig}; no separate annotation needed. 404 if the
     * lead isn't visible in this tenant — we don't want to confirm/deny
     * existence of ids outside the photographer's scope.
     */
    @GetMapping("/leads/{id}/activity")
    public ResponseEntity<List<AuditLogResponse>> getActivity(@PathVariable UUID id) {
        return ResponseEntity.ok(leadReportingService.getActivity(id));
    }

    @GetMapping("/leads")
    public ResponseEntity<List<LeadResponse>> getLeads(
        @RequestParam(required = false) String score,
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        List<LeadResponse> leads = leadService.getLeads(score, status, page, size);
        return ResponseEntity.ok(leads);
    }

    private void checkRateLimit(String ipAddress) {
        String key = "lead:rate:" + ipAddress;
        Long count = redisTemplate.opsForValue().increment(key);

        if (count != null) {
            if (count == 1) {
                redisTemplate.expire(key, RATE_LIMIT_WINDOW);
            }
            if (count > RATE_LIMIT_MAX_REQUESTS) {
                throw new TooManyRequestsException(
                    "Too many requests. Maximum " + RATE_LIMIT_MAX_REQUESTS +
                    " requests allowed per " + RATE_LIMIT_WINDOW.toMinutes() + " minutes."
                );
            }
        }
    }
}
