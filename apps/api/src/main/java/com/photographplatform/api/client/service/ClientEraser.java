package com.photographplatform.api.client.service;

import com.photographplatform.api.client.domain.Client;
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
 * Erasure of the subject's entries in the studio's client directory.
 *
 * <p>Identifies before bookings do, because a booking can name its client by
 * directory entry rather than by address. Bookings that pointed here fall back
 * to {@code NULL} ({@code ON DELETE SET NULL}).
 */
@Component
@Order(200)
@Transactional(propagation = Propagation.MANDATORY)
public class ClientEraser implements PersonalDataEraser {

    private final ClientRepository clientRepository;

    public ClientEraser(ClientRepository clientRepository) {
        this.clientRepository = clientRepository;
    }

    @Override
    public void identify(ErasureSubject subject) {
        subject.addClientIds(clientRepository.findByEmailIgnoreCase(subject.email()).stream()
            .map(Client::getId)
            .collect(Collectors.toSet()));
    }

    @Override
    public List<ErasureOutcome> erase(ErasureSubject subject) {
        List<Client> entries = clientRepository.findByEmailIgnoreCase(subject.email());
        clientRepository.deleteAll(entries);
        return List.of(ErasureOutcome.deleted("clients", entries.size()));
    }
}
