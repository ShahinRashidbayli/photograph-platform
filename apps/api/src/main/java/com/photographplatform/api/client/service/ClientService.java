package com.photographplatform.api.client.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.client.domain.Client;
import com.photographplatform.api.client.dto.ClientResponse;
import com.photographplatform.api.client.dto.UpdateClientNotesRequest;
import com.photographplatform.api.client.repository.ClientRepository;
import com.photographplatform.api.client.repository.ClientRepository.ClientStatsView;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.Normalize;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The client directory.
 *
 * <p>Read-mostly by design: a client row exists because they have a booking,
 * and every figure on it (totals, last booking date, upcoming count) is
 * derived from bookings. Notes are the one field a photographer owns, so they
 * are the only mutation here — there is deliberately no create or delete.
 *
 * <p>Everything below used to live in {@code ClientController}, which reached
 * straight into the repository and carried its own {@code @Transactional}.
 * Tenant scoping is RLS's job either way, so an id can only ever resolve
 * inside the caller's own tenant.
 */
@Service
public class ClientService {

    private final ClientRepository clientRepository;
    private final AuditService auditService;

    public ClientService(ClientRepository clientRepository, AuditService auditService) {
        this.clientRepository = clientRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<ClientResponse> list() {
        return clientRepository.findAllWithStats().stream()
            .map(ClientService::toResponse)
            .toList();
    }

    /**
     * Replaces a client's private notes. A blank body clears them.
     *
     * <p>Reports 404 for an unknown id. The previous implementation looked the
     * updated row up by filtering the whole directory and answered {@code 200}
     * with a {@code null} body when it wasn't there — a success status for a
     * write that never happened.
     */
    @Transactional
    public ClientResponse updateNotes(UUID id, UpdateClientNotesRequest request, String ipAddress) {
        Client client = clientRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Client not found: " + id));

        client.setNotes(Normalize.trimToNull(request.notes()));
        clientRepository.save(client);

        auditService.log("CLIENT_NOTES_UPDATED", "CLIENT", id,
            SecurityUtils.requireCurrentTenantId(), SecurityUtils.requireCurrentUserId(), ipAddress);

        // Re-read through the projection so the response carries the derived
        // booking stats, not just the columns on the entity.
        return clientRepository.findStatsById(id)
            .map(ClientService::toResponse)
            .orElseThrow(() -> new NotFoundException("Client not found: " + id));
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
