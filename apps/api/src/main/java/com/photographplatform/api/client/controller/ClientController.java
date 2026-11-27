package com.photographplatform.api.client.controller;

import com.photographplatform.api.client.dto.ClientDetailResponse;
import com.photographplatform.api.client.dto.ClientResponse;
import com.photographplatform.api.client.dto.UpdateClientNotesRequest;
import com.photographplatform.api.client.service.ClientService;
import com.photographplatform.api.common.security.ClientIp;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ClientController {

    private final ClientService clientService;

    public ClientController(ClientService clientService) {
        this.clientService = clientService;
    }

    @GetMapping("/clients")
    public ResponseEntity<List<ClientResponse>> listClients() {
        return ResponseEntity.ok(clientService.list());
    }

    /** One client with their bookings, galleries, invoices and contracts. */
    @GetMapping("/clients/{id}")
    public ResponseEntity<ClientDetailResponse> getClient(@PathVariable UUID id) {
        return ResponseEntity.ok(clientService.get(id));
    }

    /**
     * Update a client's private notes — the one mutable field on a client. The
     * rest (totals, last-booking date) are derived from bookings, so there is
     * no create/delete surface: a client exists because they have a booking.
     */
    @PatchMapping("/clients/{id}/notes")
    public ResponseEntity<ClientResponse> updateNotes(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateClientNotesRequest request,
        HttpServletRequest http
    ) {
        return ResponseEntity.ok(clientService.updateNotes(id, request, ClientIp.from(http)));
    }
}
