package com.photographplatform.api.invoice.controller;

import com.photographplatform.api.invoice.dto.InvoiceResponse;
import com.photographplatform.api.invoice.service.InvoiceService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The client's own invoices.
 *
 * <p>Separate from {@link InvoiceController} because the two audiences need
 * opposite defaults: that one is keyed on a booking id and closed to CUSTOMER
 * tokens (it exposes the whole tenant's financial PII), while this one takes
 * no id at all and derives ownership from the caller's identity. Lives under
 * {@code /api/customer/**}, which {@code SecurityConfig} gates to CUSTOMER.
 *
 * <p>Without it the client had no way to reach an invoice: they could pay one
 * ({@code /api/invoices/{id}/payments}) but never discover its id.
 */
@RestController
@RequestMapping("/api/customer/invoices")
public class CustomerInvoiceController {

    private final InvoiceService invoiceService;

    public CustomerInvoiceController(InvoiceService invoiceService) {
        this.invoiceService = invoiceService;
    }

    @GetMapping
    public ResponseEntity<List<InvoiceResponse>> listOwn() {
        return ResponseEntity.ok(invoiceService.listForCustomer());
    }
}
