package com.photographplatform.api.invoice.controller;

import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.invoice.dto.CreateInvoiceRequest;
import com.photographplatform.api.invoice.dto.InvoiceResponse;
import com.photographplatform.api.invoice.service.InvoiceService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.time.Year;
import java.util.List;
import java.util.UUID;
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
public class InvoiceController {

    private final InvoiceService invoiceService;

    public InvoiceController(InvoiceService invoiceService) {
        this.invoiceService = invoiceService;
    }

    @PostMapping("/bookings/{bookingId}/invoices")
    public ResponseEntity<InvoiceResponse> issue(
        @PathVariable UUID bookingId,
        @Valid @RequestBody CreateInvoiceRequest request,
        HttpServletRequest http
    ) {
        return ResponseEntity.ok(
            invoiceService.issueForBooking(bookingId, request, ClientIp.from(http)));
    }

    @GetMapping("/bookings/{bookingId}/invoices")
    public ResponseEntity<List<InvoiceResponse>> listForBooking(@PathVariable UUID bookingId) {
        return ResponseEntity.ok(invoiceService.listForBooking(bookingId));
    }

    @GetMapping("/invoices/{id}")
    public ResponseEntity<InvoiceResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(invoiceService.get(id));
    }

    @PostMapping("/invoices/{id}/storno")
    public ResponseEntity<InvoiceResponse> storno(@PathVariable UUID id, HttpServletRequest http) {
        return ResponseEntity.ok(invoiceService.storno(id, ClientIp.from(http)));
    }

    /**
     * DATEV EXTF Buchungsstapel export for one fiscal year — the "Steuerberater
     * bekommt den DATEV-Export mit einem Klick" wedge (spec §2.1). Defaults to
     * the current year so the common case ("export what I've issued so far
     * this year") needs no query param.
     */
    @GetMapping("/invoices/export.datev.csv")
    public void exportDatevCsv(
        @RequestParam(required = false) Integer year,
        HttpServletResponse response
    ) throws IOException {
        int resolvedYear = year != null ? year : Year.now().getValue();
        response.setStatus(HttpStatus.OK.value());
        response.setContentType("text/csv; charset=windows-1252");
        response.setHeader(
            "Content-Disposition",
            "attachment; filename=\"datev-buchungsstapel-" + resolvedYear + ".csv\""
        );
        invoiceService.exportDatevCsv(response.getOutputStream(), resolvedYear);
    }
}
