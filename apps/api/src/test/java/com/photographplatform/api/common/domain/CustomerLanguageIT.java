package com.photographplatform.api.common.domain;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.inquiry.domain.InquiryRequest;
import com.photographplatform.api.inquiry.repository.InquiryRequestRepository;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.repository.LeadRepository;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The Customer's language and the studio's enquiry acknowledgement switch (V40)
 * against a real Postgres: what a record saved without either reads back as,
 * and that the column holds the lowercase code its CHECK constraint allows.
 *
 * <p>Each step runs in its own transaction, like {@code RlsCrossTenantIsolationIT},
 * so the reads come from the database rather than the persistence context.
 */
class CustomerLanguageIT extends IntegrationTestBase {

    @Autowired private TenantRepository tenantRepository;
    @Autowired private LeadRepository leadRepository;
    @Autowired private InquiryRequestRepository inquiryRequestRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private PlatformTransactionManager txManager;

    @Test
    void aNewStudioSendsTheEnquiryAcknowledgement() {
        UUID tenantId = createTenant();

        Tenant reloaded = tx(() -> tenantRepository.findById(tenantId).orElseThrow());

        assertThat(reloaded.isEnquiryAcknowledgementEnabled()).isTrue();
        assertThat(tx(() -> entityManager.createNativeQuery(
                "SELECT enquiry_acknowledgement_enabled FROM tenants WHERE id = :id")
            .setParameter("id", tenantId).getSingleResult())).isEqualTo(true);
    }

    @Test
    void theEnquiryAcknowledgementCanBeSwitchedOff() {
        UUID tenantId = createTenant();

        tx(() -> {
            Tenant tenant = tenantRepository.findById(tenantId).orElseThrow();
            tenant.setEnquiryAcknowledgementEnabled(false);
            return tenantRepository.save(tenant);
        });

        assertThat(tx(() -> tenantRepository.findById(tenantId).orElseThrow()
            .isEnquiryAcknowledgementEnabled())).isFalse();
    }

    @Test
    void aLeadSavedWithoutALanguageIsGerman() {
        UUID tenantId = createTenant();
        UUID leadId = as(tenantId, () -> leadRepository.save(newLead(tenantId)).getId());

        assertThat(as(tenantId, () -> leadRepository.findById(leadId).orElseThrow().getLanguage()))
            .isEqualTo(CustomerLanguage.DE);
        assertThat(storedLanguage(tenantId, "leads", leadId)).isEqualTo("de");
    }

    @Test
    void anInquiryRequestSavedWithoutALanguageIsGerman() {
        UUID tenantId = createTenant();
        UUID inquiryId = as(tenantId, () -> inquiryRequestRepository.save(newInquiry(tenantId)).getId());

        assertThat(as(tenantId, () -> inquiryRequestRepository.findById(inquiryId).orElseThrow().getLanguage()))
            .isEqualTo(CustomerLanguage.DE);
        assertThat(storedLanguage(tenantId, "inquiry_requests", inquiryId)).isEqualTo("de");
    }

    @Test
    void aBookingSavedWithoutALanguageIsGerman() {
        UUID tenantId = createTenant();
        UUID bookingId = as(tenantId, () -> bookingRepository.save(newBooking(tenantId)).getId());

        assertThat(as(tenantId, () -> bookingRepository.findById(bookingId).orElseThrow().getLanguage()))
            .isEqualTo(CustomerLanguage.DE);
        assertThat(storedLanguage(tenantId, "bookings", bookingId)).isEqualTo("de");
    }

    /**
     * The column default, not just the entity's: rows that existed before V40,
     * and anything written with SQL, read as German too.
     */
    @Test
    void aBookingInsertedWithoutTheColumnReadsAsGerman() {
        UUID tenantId = createTenant();
        UUID bookingId = UUID.randomUUID();
        as(tenantId, () -> entityManager.createNativeQuery("""
                INSERT INTO bookings (id, tenant_id, client_name, client_email, event_date)
                VALUES (:id, :tenantId, 'Lea Brandt', 'lea@example.test', :eventDate)
                """)
            .setParameter("id", bookingId)
            .setParameter("tenantId", tenantId)
            .setParameter("eventDate", LocalDate.now().plusDays(30))
            .executeUpdate());

        assertThat(as(tenantId, () -> bookingRepository.findById(bookingId).orElseThrow().getLanguage()))
            .isEqualTo(CustomerLanguage.DE);
    }

    @Test
    void englishIsStoredAsItsLowercaseCode() {
        UUID tenantId = createTenant();
        UUID bookingId = as(tenantId, () -> {
            Booking booking = newBooking(tenantId);
            booking.setLanguage(CustomerLanguage.EN);
            return bookingRepository.save(booking).getId();
        });

        assertThat(storedLanguage(tenantId, "bookings", bookingId)).isEqualTo("en");
        assertThat(as(tenantId, () -> bookingRepository.findById(bookingId).orElseThrow().getLanguage()))
            .isEqualTo(CustomerLanguage.EN);
    }

    @Test
    void theDatabaseRejectsALanguageOutsideTheSet() {
        UUID tenantId = createTenant();
        UUID leadId = as(tenantId, () -> leadRepository.save(newLead(tenantId)).getId());

        assertThatThrownBy(() -> as(tenantId, () -> entityManager.createNativeQuery(
                "UPDATE leads SET language = 'fr' WHERE id = :id")
            .setParameter("id", leadId)
            .executeUpdate()))
            .hasStackTraceContaining("leads_language_check");
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    private UUID createTenant() {
        return tx(() -> tenantRepository.save(new Tenant("language-test-" + UUID.randomUUID(),
            "owner-" + UUID.randomUUID() + "@example.test")).getId());
    }

    private static Lead newLead(UUID tenantId) {
        Lead lead = new Lead("Maria Kellner", "maria@example.test", null, null, null, null, null,
            "203.0.113.5");
        lead.setTenantId(tenantId);
        return lead;
    }

    private static InquiryRequest newInquiry(UUID tenantId) {
        InquiryRequest inquiry = new InquiryRequest(UUID.randomUUID(), "HOCHZEIT", "OVER_2000",
            LocalDate.now().plusDays(60), "Berlin", "Hallo", "HIGH", "BIO_LINK");
        inquiry.setTenantId(tenantId);
        return inquiry;
    }

    private static Booking newBooking(UUID tenantId) {
        Booking booking = new Booking("Jonas Weber", "jonas@example.test", LocalDate.now().plusDays(30));
        booking.setTenantId(tenantId);
        return booking;
    }

    /** The raw column value, so the test sees what the converter wrote. */
    private Object storedLanguage(UUID tenantId, String table, UUID id) {
        return as(tenantId, () -> entityManager.createNativeQuery(
                "SELECT language FROM " + table + " WHERE id = :id")
            .setParameter("id", id)
            .getSingleResult());
    }

    private <T> T tx(Supplier<T> action) {
        return new TransactionTemplate(txManager).execute(status -> action.get());
    }

    private <T> T as(UUID tenantId, Supplier<T> action) {
        TenantContext.setTenant(tenantId.toString());
        try {
            return tx(action);
        } finally {
            TenantContext.clear();
        }
    }
}
