package com.photographplatform.api.client.controller;

import com.photographplatform.api.client.dto.ClientResponse;
import com.photographplatform.api.client.repository.ClientRepository;
import com.photographplatform.api.client.repository.ClientRepository.ClientStatsView;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ClientController {

    private final ClientRepository clientRepository;

    public ClientController(ClientRepository clientRepository) {
        this.clientRepository = clientRepository;
    }

    @GetMapping("/clients")
    public ResponseEntity<List<ClientResponse>> listClients() {
        List<ClientResponse> clients = clientRepository.findAllWithStats().stream()
            .map(ClientController::toResponse)
            .toList();
        return ResponseEntity.ok(clients);
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
