package com.photographplatform.api.client.controller;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.client.domain.Client;
import com.photographplatform.api.client.dto.ClientResponse;
import com.photographplatform.api.client.dto.UpdateClientNotesRequest;
import com.photographplatform.api.client.repository.ClientRepository;
import com.photographplatform.api.client.repository.ClientRepository.ClientStatsView;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ClientController {

    private final ClientRepository clientRepository;
    private final AuditService auditService;

    public ClientController(ClientRepository clientRepository, AuditService auditService) {
        this.clientRepository = clientRepository;
        this.auditService = auditService;
    }

    @GetMapping("/clients")
    public ResponseEntity<List<ClientResponse>> listClients() {
        List<ClientResponse> clients = clientRepository.findAllWithStats().stream()
            .map(ClientController::toResponse)
            .toList();
        return ResponseEntity.ok(clients);
    }

    /**
     * Update a client's private notes. This is the one mutable field on a
     * client: the rest (totals, last-booking date) are derived from bookings,
     * so there is no create/delete surface — a client exists because they have
     * a booking. The clients table is tenant-scoped by search_path, so the id
     * can only resolve within the caller's own schema.
     */
    @PatchMapping("/clients/{id}/notes")
    @Transactional
    public ResponseEntity<ClientResponse> updateNotes(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateClientNotesRequest request,
        HttpServletRequest http
    ) {
        Client client = clientRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Client not found: " + id));

        String notes = request.notes() == null || request.notes().isBlank()
            ? null
            : request.notes().trim();
        client.setNotes(notes);
        clientRepository.save(client);

        auditService.log("CLIENT_NOTES_UPDATED", "CLIENT", id,
            SecurityUtils.requireCurrentTenantId(), SecurityUtils.requireCurrentUserId(),
            http.getRemoteAddr());

        return clientRepository.findAllWithStats().stream()
            .filter(v -> id.equals(v.getId()))
            .findFirst()
            .map(ClientController::toResponse)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.ok(null));
    }

    private static ClientResponse toResponse(ClientStatsView v) {
        return new ClientResponse(
            v.getId(),
            v.getEmail(),
            v.getFullName(),
            v.getPhone(),
            v.getNotes(),
            v.getTotalBookings(),
            v.getTotalSpentCents(),
            v.getUpcomingBookings() == null ? 0 : v.getUpcomingBookings().intValue(),
            v.getLastBookingDate(),
            v.getCreatedAt() == null ? null : OffsetDateTime.ofInstant(v.getCreatedAt(), ZoneOffset.UTC)
        );
    }
}
