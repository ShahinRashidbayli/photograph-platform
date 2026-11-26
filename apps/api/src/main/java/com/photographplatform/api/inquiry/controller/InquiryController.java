package com.photographplatform.api.inquiry.controller;

import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.inquiry.dto.InquiryRequestResponse;
import com.photographplatform.api.inquiry.dto.UpdateInquiryStatusRequest;
import com.photographplatform.api.inquiry.service.InquiryRequestService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The photographer's inquiry inbox (roadmap §4.5.7). Lists every inquiry in the
 * tenant and lets the photographer triage a pending one to accepted/rejected;
 * an inquiry also emails the photographer on arrival, so a submitted request is
 * never a black hole. The accept → booking conversion is the next slice.
 *
 * <p>{@code /api/inquiries/**} is role-gated to PHOTOGRAPHER/ADMIN in
 * {@code SecurityConfig}: an inquiry list exposes other customers' names,
 * emails and budgets, and CUSTOMER tokens share this tenant.
 */
@RestController
@RequestMapping("/api/inquiries")
public class InquiryController {

    private final InquiryRequestService inquiryService;

    public InquiryController(InquiryRequestService inquiryService) {
        this.inquiryService = inquiryService;
    }

    @GetMapping
    public ResponseEntity<List<InquiryRequestResponse>> list(
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(inquiryService.listForPhotographer(status, page, size));
    }

    /**
     * Triage a pending inquiry to {@code ACCEPTED} or {@code REJECTED}. Keeps
     * the inbox from silently accumulating {@code PENDING} rows forever and
     * gives the audit trail an explicit accept/reject action.
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<InquiryRequestResponse> updateStatus(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateInquiryStatusRequest request,
        HttpServletRequest httpRequest
    ) {
        return ResponseEntity.ok(
            inquiryService.updateStatus(id, request.status(), request.note(), ClientIp.from(httpRequest)));
    }
}
