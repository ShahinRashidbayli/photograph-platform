package com.photographplatform.api.payment.controller;

import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.payment.dto.CreatePaymentIntentRequest;
import com.photographplatform.api.payment.dto.InvoicePaymentSummaryResponse;
import com.photographplatform.api.payment.dto.PaymentResponse;
import com.photographplatform.api.payment.dto.RecordManualPaymentRequest;
import com.photographplatform.api.payment.service.PaymentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/invoices/{invoiceId}/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping
    public ResponseEntity<InvoicePaymentSummaryResponse> summary(@PathVariable UUID invoiceId) {
        return ResponseEntity.ok(paymentService.getSummary(invoiceId));
    }

    @PostMapping("/intent")
    public ResponseEntity<PaymentResponse> createIntent(
        @PathVariable UUID invoiceId,
        @Valid @RequestBody CreatePaymentIntentRequest request,
        HttpServletRequest http
    ) {
        return ResponseEntity.ok(
            paymentService.createStripePaymentIntent(invoiceId, request, ClientIp.from(http)));
    }

    @PostMapping("/manual")
    public ResponseEntity<PaymentResponse> recordManual(
        @PathVariable UUID invoiceId,
        @RequestBody(required = false) RecordManualPaymentRequest request,
        HttpServletRequest http
    ) {
        RecordManualPaymentRequest body = request != null ? request : new RecordManualPaymentRequest(null);
        return ResponseEntity.ok(paymentService.recordManualPayment(invoiceId, body, ClientIp.from(http)));
    }
}
