package com.photographplatform.api.contract.controller;

import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.contract.dto.ContractResponse;
import com.photographplatform.api.contract.dto.SignContractRequest;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The customer's own contracts, and the act of signing one.
 *
 * <p>Separate from {@link ContractController} for the reason
 * {@code CustomerInvoiceController} is separate from its photographer twin: the
 * two audiences need opposite defaults. That one is keyed on the tenant and
 * exposes drafts; this one takes no tenant at all, derives ownership from the
 * caller's own email, and never shows a draft. Lives under
 * {@code /api/customer/**}, which {@code SecurityConfig} gates to CUSTOMER.
 */
@RestController
@RequestMapping("/api/customer/contracts")
public class CustomerContractController {

    private final ContractService contractService;

    public CustomerContractController(ContractService contractService) {
        this.contractService = contractService;
    }

    @GetMapping
    public ResponseEntity<List<ContractResponse>> listOwn() {
        return ResponseEntity.ok(contractService.listForCustomer());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ContractResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(contractService.getForCustomer(id));
    }

    @PostMapping("/{id}/sign")
    public ResponseEntity<ContractResponse> sign(
        @PathVariable UUID id,
        @Valid @RequestBody SignContractRequest request,
        HttpServletRequest http
    ) {
        return ResponseEntity.ok(contractService.sign(
            id, request, ClientIp.from(http), http.getHeader(HttpHeaders.USER_AGENT)));
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable UUID id) {
        ContractResponse contract = contractService.getForCustomer(id);
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + contractService.pdfFilename(contract) + "\"")
            .body(contractService.renderPdfForCustomer(id));
    }
}
