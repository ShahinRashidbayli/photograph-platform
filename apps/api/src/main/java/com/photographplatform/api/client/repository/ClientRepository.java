package com.photographplatform.api.client.repository;

import com.photographplatform.api.client.domain.Client;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The deprecated {@code clients} table (see V40). The directory no longer
 * reads it — that is {@link ClientNoteRepository} — but it can still hold
 * personal data written before, and {@code CreateBookingRequest.clientId}
 * still points at it, so it keeps the two lookups those need until it is
 * dropped.
 */
public interface ClientRepository extends JpaRepository<Client, UUID> {

    /** Legacy entries for one address, for Art. 17 erasure. Case-insensitive, like the address itself. */
    List<Client> findByEmailIgnoreCase(String email);
}
