package com.photographplatform.api.lead.controller;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.TooManyRequestsException;
import com.photographplatform.api.lead.dto.CreateLeadRequest;
import com.photographplatform.api.lead.dto.LeadResponse;
import com.photographplatform.api.lead.service.LeadService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
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
    private final TenantRepository tenantRepository;
    private final StringRedisTemplate redisTemplate;

    public LeadController(LeadService leadService, TenantRepository tenantRepository,
                         StringRedisTemplate redisTemplate) {
        this.leadService = leadService;
        this.tenantRepository = tenantRepository;
        this.redisTemplate = redisTemplate;
    }

    @PostMapping("/public/leads/{subdomain}")
    public ResponseEntity<LeadResponse> createLead(
        @PathVariable String subdomain,
        @Valid @RequestBody CreateLeadRequest request,
        HttpServletRequest httpRequest
    ) {
        String ip = resolveClientIp(httpRequest);

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

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isEmpty()) {
            return forwarded.split(",")[0].trim();
        }

        String real = request.getHeader("X-Real-IP");
        if (real != null && !real.isEmpty()) {
            return real;
        }

        return request.getRemoteAddr();
    }
}
