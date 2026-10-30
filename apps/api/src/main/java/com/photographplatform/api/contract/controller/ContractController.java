package com.photographplatform.api.contract.controller;

import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.contract.dto.ContractResponse;
import com.photographplatform.api.contract.dto.CreateContractRequest;
import com.photographplatform.api.contract.dto.UpdateContractRequest;
import com.photographplatform.api.contract.service.ContractService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The photographer's contracts. Gated to PHOTOGRAPHER/ADMIN in
 * {@code SecurityConfig}; the plan gate ({@code Capability.CONTRACTS}) is
 * applied in {@link ContractService}, where it can be applied to writes only.
 */
@RestController
@RequestMapping("/api")
public class ContractController {

    private final ContractService contractService;

    public ContractController(ContractService contractService) {
        this.contractService = contractService;
    }

    @GetMapping("/contracts")
    public ResponseEntity<List<ContractResponse>> list() {
        return ResponseEntity.ok(contractService.listForTenant());
    }

    @GetMapping("/contracts/{id}")
    public ResponseEntity<ContractResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(contractService.get(id));
    }

    @GetMapping("/bookings/{bookingId}/contracts")
    public ResponseEntity<List<ContractResponse>> listForBooking(@PathVariable UUID bookingId) {
        return ResponseEntity.ok(contractService.listForBooking(bookingId));
    }

    @PostMapping("/bookings/{bookingId}/contracts")
    public ResponseEntity<ContractResponse> create(
        @PathVariable UUID bookingId,
        @Valid @RequestBody CreateContractRequest request,
        HttpServletRequest http
    ) {
        return ResponseEntity.ok(
            contractService.createForBooking(bookingId, request, ClientIp.from(http)));
    }

    @PutMapping("/contracts/{id}")
    public ResponseEntity<ContractResponse> update(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateContractRequest request,
        HttpServletRequest http
    ) {
        return ResponseEntity.ok(contractService.update(id, request, ClientIp.from(http)));
    }

    @PostMapping("/contracts/{id}/send")
    public ResponseEntity<ContractResponse> send(@PathVariable UUID id, HttpServletRequest http) {
        return ResponseEntity.ok(contractService.send(id, ClientIp.from(http)));
    }

    @PostMapping("/contracts/{id}/cancel")
    public ResponseEntity<ContractResponse> cancel(@PathVariable UUID id, HttpServletRequest http) {
        return ResponseEntity.ok(contractService.cancel(id, ClientIp.from(http)));
    }

    @GetMapping("/contracts/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable UUID id) {
        ContractResponse contract = contractService.get(id);
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + contractService.pdfFilename(contract) + "\"")
            .body(contractService.renderPdf(id));
    }
}
