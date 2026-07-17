package com.photographplatform.api.inquiry.controller;

import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.inquiry.dto.CreateInquiryRequest;
import com.photographplatform.api.inquiry.dto.InquiryRequestResponse;
import com.photographplatform.api.inquiry.service.InquiryRequestService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The customer's side of the inquiry flow (roadmap §4.5.7).
 *
 * <p>{@code /api/customer/**} is role-gated to CUSTOMER in {@code SecurityConfig}.
 * The photographer's tenant and the customer's identity both come from the JWT,
 * so neither appears in the path or the body — this endpoint takes no subdomain
 * for the same reason {@code /api/customerBookings} takes no client id.
 */
@RestController
@RequestMapping("/api/customer/inquiry-requests")
public class CustomerInquiryController {

    private final InquiryRequestService inquiryService;

    public CustomerInquiryController(InquiryRequestService inquiryService) {
        this.inquiryService = inquiryService;
    }

    /**
     * Submit a session request to the photographer the customer is signed in
     * with. Returns 201 with the stored inquiry.
     *
     * <p>A tripped honeypot returns 202 without persisting: the bot sees success
     * and doesn't retry or pivot, while we spend no row and no rate-limit slot
     * on it. Same trick as the public lead form.
     */
    @PostMapping
    public ResponseEntity<InquiryRequestResponse> create(
        @Valid @RequestBody CreateInquiryRequest request,
        HttpServletRequest httpRequest
    ) {
        if (request.isHoneypotTriggered()) {
            return ResponseEntity.accepted().build();
        }
        InquiryRequestResponse created =
            inquiryService.create(request, ClientIp.from(httpRequest));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /** The customer's own request history — scoped to their JWT identity. */
    @GetMapping
    public ResponseEntity<List<InquiryRequestResponse>> listOwn(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(inquiryService.listForCustomer(page, size));
    }
}
