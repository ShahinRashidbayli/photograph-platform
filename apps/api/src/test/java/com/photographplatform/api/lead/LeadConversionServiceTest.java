package com.photographplatform.api.lead;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.service.BookingService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.domain.LeadStatus;
import com.photographplatform.api.lead.dto.ConvertLeadRequest;
import com.photographplatform.api.lead.repository.LeadRepository;
import com.photographplatform.api.lead.service.LeadConversionService;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit-level verification of {@link LeadService#convertLead} — the orchestrator
 * that closes Sprint 4 by turning a lead into a booking.
 *
 * <p>Three behaviours matter:
 * <ul>
 *   <li>Happy path: the booking is created via {@link BookingService}, the lead
 *       flips to {@code BOOKED}, and a {@code LEAD_CONVERTED} audit row is
 *       written carrying the prior status so the trail is honest.</li>
 *   <li>404 on an unknown lead id — must not silently create a dangling
 *       booking.</li>
 *   <li>409 when the lead is already {@code BOOKED} — idempotent on the lead
 *       side: a duplicate convert call must not produce a second booking.</li>
 * </ul>
 */
class LeadConversionServiceTest {

    private static final UUID ACTOR_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final String IP = "203.0.113.7";

    private LeadRepository leadRepository;
    private BookingService bookingService;
    private AuditService auditService;
    private LeadConversionService conversionService;

    @BeforeEach
    void setUp() {
        leadRepository = mock(LeadRepository.class);
        bookingService = mock(BookingService.class);
        auditService = mock(AuditService.class);

        // Conversion now has exactly the three collaborators it actually uses.
        // Previously this test had to hand LeadService five more — an event
        // publisher, a user repository, an audit-log repository, a scorer and
        // a CSV exporter — none of which the conversion path touches; that
        // list of no-op mocks was the clearest signal the class was doing too
        // much.
        conversionService = new LeadConversionService(leadRepository, bookingService, auditService);

        // Authenticate as the photographer for currentUserId() — the audit row
        // must record *who* converted the lead.
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(ACTOR_ID.toString(), null)
        );
        // Tenant id is read from TenantContext (set from the JWT claim in
        // production) rather than a User→tenant DB lookup, so pin it here.
        TenantContext.setTenant(TENANT_ID.toString());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void convertingNewLeadCreatesBookingFlipsStatusAndAudits() {
        Lead lead = newLead(LeadStatus.NEW);
        when(leadRepository.findById(lead.getId())).thenReturn(Optional.of(lead));

        BookingResponse stubBooking = stubBookingResponse();
        when(bookingService.createFromLead(eq(lead), any(ConvertLeadRequest.class), eq(IP)))
            .thenReturn(stubBooking);

        ConvertLeadRequest request = new ConvertLeadRequest(null, "Berlin", null, 80000, 20000, null);

        BookingResponse result = conversionService.convertLead(lead.getId(), request, IP);

        assertThat(result).isSameAs(stubBooking);
        assertThat(lead.getStatus()).isEqualTo(LeadStatus.BOOKED);
        verify(leadRepository).save(lead);

        // The conversion audit row must carry the prior status so a future
        // reader can reconstruct the lifecycle without joining tables.
        verify(auditService).log(
            eq("LEAD_CONVERTED"),
            eq("LEAD"),
            eq(lead.getId()),
            eq(TENANT_ID),
            eq(ACTOR_ID),
            eq(IP),
            eq("NEW"),
            eq("BOOKED")
        );
    }

    @Test
    void convertingUnknownLeadThrowsNotFound() {
        UUID missing = UUID.randomUUID();
        when(leadRepository.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
            conversionService.convertLead(missing, emptyOverrides(), IP)
        ).isInstanceOf(NotFoundException.class);

        // Crucially: no booking is created and no audit row is written.
        verify(bookingService, never()).createFromLead(any(), any(), anyString());
        verify(auditService, never()).log(
            anyString(), anyString(), any(), any(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void convertingAlreadyBookedLeadThrowsConflict() {
        Lead lead = newLead(LeadStatus.BOOKED);
        when(leadRepository.findById(lead.getId())).thenReturn(Optional.of(lead));

        assertThatThrownBy(() ->
            conversionService.convertLead(lead.getId(), emptyOverrides(), IP)
        ).isInstanceOf(ConflictException.class);

        // Idempotency contract: a second convert must not produce a duplicate
        // booking. If this assertion ever flips, callers retrying on a network
        // blip will silently double-book photographers' calendars.
        verify(bookingService, never()).createFromLead(any(), any(), anyString());
        verify(leadRepository, never()).save(any());
    }

    @Test
    void bookingCreationFailureLeavesLeadStatusUnchanged() {
        Lead lead = newLead(LeadStatus.REPLIED);
        when(leadRepository.findById(lead.getId())).thenReturn(Optional.of(lead));
        when(bookingService.createFromLead(any(), any(), anyString()))
            .thenThrow(new RuntimeException("DB down"));

        assertThatThrownBy(() ->
            conversionService.convertLead(lead.getId(), emptyOverrides(), IP)
        ).isInstanceOf(RuntimeException.class);

        // The lead must not advertise "BOOKED" without a matching booking row.
        // @Transactional rollback handles persistence, but the in-memory entity
        // mutation must also not have happened before the failing call.
        assertThat(lead.getStatus()).isEqualTo(LeadStatus.REPLIED);
        verify(leadRepository, never()).save(any());
    }

    private static Lead newLead(LeadStatus status) {
        Lead lead = new Lead("Anna Schmidt", "anna@example.de", "+491701234567",
            LocalDate.now().plusDays(90), "WEDDING", "500_1000", "Need details", "1.2.3.4");
        lead.setStatus(status);
        // Lead.id is JPA-generated; for unit tests reflect it in via the
        // accessor pattern — the existing entity exposes no setter, so we use
        // a fake by tagging via reflection-friendly means.
        setLeadId(lead, UUID.randomUUID());
        return lead;
    }

    private static void setLeadId(Lead lead, UUID id) {
        try {
            var field = Lead.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(lead, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("Lead.id field missing — entity layout changed", e);
        }
    }

    private static ConvertLeadRequest emptyOverrides() {
        return new ConvertLeadRequest(null, null, null, null, null, null);
    }

    private static BookingResponse stubBookingResponse() {
        return new BookingResponse(
            UUID.randomUUID(),
            "Anna Schmidt",
            "anna@example.de",
            LocalDate.now().plusDays(90),
            null, "WEDDING", null, null, 0, 0,
            "ENQUIRY", "NOT_INVOICED", 0, null,
            OffsetDateTime.now()
        );
    }

    // Audit logger has two overloads; satisfy the verifier for the 8-arg form.
    @SuppressWarnings("unused")
    private void unusedOverloadAnchor(ArgumentCaptor<String> captor) {
        verify(auditService, times(0)).log(anyString(), anyString(), any(), any(), any(), anyString());
    }
}
