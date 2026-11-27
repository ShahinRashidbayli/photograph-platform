package com.photographplatform.api.client.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.domain.BookingStatus;
import com.photographplatform.api.client.domain.ClientNote;
import com.photographplatform.api.client.dto.ClientResponse;
import com.photographplatform.api.client.dto.UpdateClientNotesRequest;
import com.photographplatform.api.client.repository.ClientNoteRepository;
import com.photographplatform.api.client.repository.ClientNoteRepository.ClientBooking;
import com.photographplatform.api.client.repository.ClientNoteRepository.ClientView;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.repository.QueryLimits;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.BusinessZone;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.invoice.domain.BookingSettlement;
import com.photographplatform.api.invoice.service.Settlement;
import com.photographplatform.api.lead.service.LeadReportingService;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The client directory.
 *
 * <p>A client is the set of the studio's bookings that share an address, so a
 * client appears with their first booking — created directly, or converted
 * from a lead or an enquiry — with nothing to create or backfill, and every
 * figure on them is derived (see {@link ClientNoteRepository}). The directory
 * used to read a {@code clients} table that nothing ever wrote, which left the
 * page empty for every studio but the seeded demo.
 *
 * <p>Two figures come from their owners rather than from the directory query.
 * Collected is the succeeded payments on the client's bookings, as invoice's
 * {@link Settlement} counts them (ADR-004 §1); the phone is the newest one
 * the client gave on a lead, since bookings record none.
 *
 * <p>Notes are the one thing a photographer writes here, and the only thing
 * stored. Tenant scoping is RLS's job, so an id only ever resolves inside the
 * caller's own tenant.
 */
@Service
public class ClientService {

    private static final List<String> NOT_HAPPENING = BookingStatus.namesOf(BookingStatus.NOT_HAPPENING);
    private static final String ERASED_PATTERN = "%" + Booking.ERASED_EMAIL_DOMAIN;

    private final ClientNoteRepository clientNoteRepository;
    private final Settlement settlement;
    private final LeadReportingService leadReportingService;
    private final AuditService auditService;
    private final Clock clock;

    public ClientService(ClientNoteRepository clientNoteRepository, Settlement settlement,
                         LeadReportingService leadReportingService, AuditService auditService, Clock clock) {
        this.clientNoteRepository = clientNoteRepository;
        this.settlement = settlement;
        this.leadReportingService = leadReportingService;
        this.auditService = auditService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ClientResponse> list() {
        return toResponses(
            clientNoteRepository.findDirectory(today(), NOT_HAPPENING, ERASED_PATTERN, QueryLimits.LIST));
    }

    /**
     * Replaces a client's private notes. A blank body clears them, deleting
     * the row rather than keeping an empty one.
     *
     * <p>Reports 404 for an id no booking of this studio carries.
     */
    @Transactional
    public ClientResponse updateNotes(UUID id, UpdateClientNotesRequest request, String ipAddress) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        ClientView client = find(id);
        String notes = Normalize.trimToNull(request.notes());

        clientNoteRepository.findByEmail(client.getEmail()).ifPresentOrElse(
            existing -> {
                if (notes == null) {
                    clientNoteRepository.delete(existing);
                } else {
                    existing.setNotes(notes);
                }
            },
            () -> {
                if (notes != null) {
                    clientNoteRepository.save(new ClientNote(tenantId, client.getEmail(), notes));
                }
            });
        clientNoteRepository.flush();

        auditService.log("CLIENT_NOTES_UPDATED", "CLIENT", id,
            tenantId, SecurityUtils.requireCurrentUserId(), ipAddress);

        return toResponses(List.of(find(id))).get(0);
    }

    private ClientView find(UUID id) {
        return clientNoteRepository.findDirectoryEntry(id, today(), NOT_HAPPENING, ERASED_PATTERN)
            .orElseThrow(() -> new NotFoundException("Client not found: " + id));
    }

    /** "Upcoming" and "last session" are calendar days the studio reads in its own zone. */
    private LocalDate today() {
        return LocalDate.now(clock.withZone(BusinessZone.ID));
    }

    /**
     * A fixed number of queries for any page: the clients' bookings, their
     * settlement (two), and their phones. Never one per client.
     */
    private List<ClientResponse> toResponses(List<ClientView> views) {
        if (views.isEmpty()) {
            return List.of();
        }
        List<String> emails = views.stream().map(ClientView::getEmail).toList();
        Map<String, Long> collected = collectedByEmail(emails);
        Map<String, String> phones = leadReportingService.latestPhoneByEmail(emails);
        return views.stream()
            .map(v -> toResponse(v, collected.getOrDefault(v.getEmail(), 0L), phones.get(v.getEmail())))
            .toList();
    }

    /** Settled per booking and added up per client, in a long: one client's bookings can pass an int. */
    private Map<String, Long> collectedByEmail(List<String> emails) {
        List<ClientBooking> bookings =
            clientNoteRepository.findBookingIds(SecurityUtils.requireCurrentTenantId(), emails);
        Map<UUID, BookingSettlement> settled =
            settlement.ofBookings(bookings.stream().map(ClientBooking::getBookingId).toList());
        return bookings.stream().collect(Collectors.groupingBy(
            ClientBooking::getEmail,
            Collectors.summingLong(b -> settled.get(b.getBookingId()).paidCents())));
    }

    private static ClientResponse toResponse(ClientView v, long collectedCents, String phone) {
        return new ClientResponse(
            v.getId(),
            v.getEmail(),
            v.getFullName(),
            phone,
            v.getNotes(),
            v.getTotalBookings(),
            collectedCents,
            Objects.requireNonNullElse(v.getUpcomingBookings(), 0),
            v.getLastBookingDate(),
            v.getCreatedAt() == null ? null : OffsetDateTime.ofInstant(v.getCreatedAt(), ZoneOffset.UTC)
        );
    }
}
