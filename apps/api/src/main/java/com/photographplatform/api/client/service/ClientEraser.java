package com.photographplatform.api.client.service;

import com.photographplatform.api.client.domain.Client;
import com.photographplatform.api.client.repository.ClientNoteRepository;
import com.photographplatform.api.client.repository.ClientRepository;
import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.ErasureSubject;
import com.photographplatform.api.common.privacy.PersonalDataEraser;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Erasure of what the client directory itself stores about the subject.
 *
 * <p>The directory is derived from bookings, so once {@code BookingEraser}
 * has anonymised those the subject drops out of it on its own; what is left
 * here is the photographer's notes about them, and any rows of the
 * deprecated {@code clients} table (V40).
 *
 * <p>Identifies before bookings do, because a booking can still name its
 * client by legacy directory entry rather than by address. Bookings that
 * pointed there fall back to {@code NULL} ({@code ON DELETE SET NULL}).
 */
@Component
@Order(200)
@Transactional(propagation = Propagation.MANDATORY)
public class ClientEraser implements PersonalDataEraser {

    private final ClientRepository clientRepository;
    private final ClientNoteRepository clientNoteRepository;

    public ClientEraser(ClientRepository clientRepository, ClientNoteRepository clientNoteRepository) {
        this.clientRepository = clientRepository;
        this.clientNoteRepository = clientNoteRepository;
    }

    @Override
    public void identify(ErasureSubject subject) {
        subject.addClientIds(clientRepository.findByEmailIgnoreCase(subject.email()).stream()
            .map(Client::getId)
            .collect(Collectors.toSet()));
    }

    @Override
    public List<ErasureOutcome> erase(ErasureSubject subject) {
        // The subject's email is already normalised, the form client_notes stores.
        int notes = clientNoteRepository.findByEmail(subject.email())
            .map(note -> {
                clientNoteRepository.delete(note);
                return 1;
            })
            .orElse(0);
        List<Client> entries = clientRepository.findByEmailIgnoreCase(subject.email());
        clientRepository.deleteAll(entries);
        return List.of(
            ErasureOutcome.deleted("client_notes", notes),
            ErasureOutcome.deleted("clients", entries.size()));
    }
}
