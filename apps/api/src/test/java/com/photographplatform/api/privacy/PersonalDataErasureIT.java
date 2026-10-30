package com.photographplatform.api.privacy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.StaffRole;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.RetentionBasis;
import com.photographplatform.api.portfolio.service.R2StorageService;
import com.photographplatform.api.privacy.application.PersonalDataErasureService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Art. 17 erasure end to end, against the real schema: RLS, the foreign keys
 * that cascade or null out, the GoBD trigger on invoices.
 *
 * <p>One studio holds Maria's data in every form it takes — a customer
 * account, a directory entry, a lead, an inquiry, two bookings (one linked to
 * her account, one only by address), a delivered gallery, a signed and a draft
 * contract, an invoice, and an audit entry that wrote her address down. Around
 * her are the people erasure must not touch: Jonas in the same studio, a
 * booking typed with Maria's address but linked to Jonas's account, and a
 * second studio that also knows Maria.
 */
class PersonalDataErasureIT extends IntegrationTestBase {

    private static final String MARIA = "maria@example.test";

    @Autowired private PersonalDataErasureService erasureService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager txManager;

    @MockitoBean private R2StorageService storage;

    private Studio studio;
    private Studio otherStudio;
    private Fixture maria;

    @BeforeEach
    void seed() {
        studio = createStudio();
        otherStudio = createStudio();
        maria = seedMaria(studio);
        seedBystanders();
    }

    @Test
    void previewReportsWhatErasureWouldDoAndChangesNothing() {
        Map<String, ErasureOutcome> preview = byCategory(as(studio, () -> erasureService.preview(MARIA)));

        assertThat(preview.get("customerAccounts").deleted()).isEqualTo(1);
        assertThat(preview.get("bookings").anonymized()).isEqualTo(2);
        assertThat(preview.get("galleryPhotos").deleted()).isEqualTo(2);

        assertThat(count("SELECT count(*) FROM users WHERE id = ?", maria.userId)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM leads WHERE tenant_id = ? AND lower(email) = ?", studio.tenantId, MARIA))
            .isEqualTo(2);
        assertThat(count("SELECT count(*) FROM galleries WHERE id = ?", maria.galleryId)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM bookings WHERE client_name = 'Maria'")).isEqualTo(2);
        verify(storage, never()).deleteObjects(anyList());
    }

    @Test
    void erasureReportsExactlyWhatThePreviewPromised() {
        List<ErasureOutcome> preview = as(studio, () -> erasureService.preview(MARIA));
        List<ErasureOutcome> erased = as(studio, () -> erasureService.erase(MARIA, "203.0.113.9"));

        assertThat(erased).isEqualTo(preview);
    }

    @Test
    void erasureRemovesThePersonAndKeepsOnlyWhatTheLawRequires() {
        Map<String, ErasureOutcome> report =
            byCategory(as(studio, () -> erasureService.erase("  Maria@Example.TEST ", "203.0.113.9")));

        // Gone.
        assertThat(count("SELECT count(*) FROM users WHERE id = ?", maria.userId)).isZero();
        assertThat(count("SELECT count(*) FROM clients WHERE id = ?", maria.clientId)).isZero();
        assertThat(count("SELECT count(*) FROM leads WHERE tenant_id = ? AND lower(email) = ?",
            studio.tenantId, MARIA)).isZero();
        assertThat(count("SELECT count(*) FROM inquiry_requests WHERE customer_id = ?", maria.userId)).isZero();
        assertThat(count("SELECT count(*) FROM galleries WHERE id = ?", maria.galleryId)).isZero();
        assertThat(count("SELECT count(*) FROM delivery_photos WHERE gallery_id = ?", maria.galleryId)).isZero();
        assertThat(count("SELECT count(*) FROM contracts WHERE id = ?", maria.draftContractId)).isZero();

        // Anonymised: still the studio's record of a shoot, no longer about her.
        for (UUID booking : List.of(maria.linkedBookingId, maria.addressOnlyBookingId)) {
            assertThat(count("""
                SELECT count(*) FROM bookings
                WHERE id = ? AND client_name = '[gelöscht]' AND client_email LIKE 'erased-%@erased.invalid'
                  AND customer_user_id IS NULL AND client_id IS NULL
                  AND location IS NULL AND internal_notes IS NULL AND total_amount_cents = 150000
                """, booking)).as("booking %s", booking).isEqualTo(1);
        }
        assertThat(count("""
            SELECT count(*) FROM audit_log
            WHERE entity_id = ? AND action = 'BOOKING_CLIENT_EMAIL_CHANGED'
              AND old_value IS NULL AND new_value IS NULL
            """, maria.addressOnlyBookingId)).isEqualTo(1);

        // Kept, untouched, and reported with the reason.
        assertThat(count("SELECT count(*) FROM contracts WHERE id = ? AND recipient_email = ?",
            maria.signedContractId, MARIA)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM invoices WHERE id = ? AND buyer_email = ?",
            maria.invoiceId, MARIA)).isEqualTo(1);
        assertThat(report.get("contracts")).isEqualTo(
            new ErasureOutcome("contracts", 1, 0, 1, RetentionBasis.LEGAL_CLAIMS));
        assertThat(report.get("invoices")).isEqualTo(
            new ErasureOutcome("invoices", 0, 0, 1, RetentionBasis.TAX_RECORDS));

        // The files go once the erasure has committed.
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> keys = ArgumentCaptor.forClass(List.class);
        verify(storage).deleteObjects(keys.capture());
        assertThat(keys.getValue()).containsExactlyInAnyOrder(
            "maria/a.jpg", "maria/thumb_a.jpg", "maria/b.jpg");
    }

    @Test
    void nobodyElseIsTouched() {
        as(studio, () -> erasureService.erase(MARIA, "203.0.113.9"));

        // Jonas, in the same studio.
        assertThat(count("SELECT count(*) FROM users WHERE email = 'jonas@example.test'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM leads WHERE email = 'jonas@example.test'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM clients WHERE email = 'jonas@example.test'")).isEqualTo(1);
        // Typed with Maria's address, but linked to Jonas's account — his booking.
        assertThat(count("SELECT count(*) FROM bookings WHERE client_name = 'Jonas' AND client_email = ?", MARIA))
            .isEqualTo(1);
        // Another studio's Maria is that studio's business.
        assertThat(count("SELECT count(*) FROM leads WHERE tenant_id = ? AND email = ?",
            otherStudio.tenantId, MARIA)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM clients WHERE tenant_id = ? AND email = ?",
            otherStudio.tenantId, MARIA)).isEqualTo(1);
    }

    /** The audit trail records that it happened — and not who it was about. */
    @Test
    void theErasureIsAuditedWithoutTheAddress() {
        as(studio, () -> erasureService.erase(MARIA, "203.0.113.9"));

        assertThat(awaitCount(() -> count(
            "SELECT count(*) FROM audit_log WHERE tenant_id = ? AND action = 'PERSONAL_DATA_ERASED'",
            studio.tenantId))).isEqualTo(1);
        assertThat(count("""
            SELECT count(*) FROM audit_log
            WHERE tenant_id = ? AND action = 'PERSONAL_DATA_ERASED'
              AND new_value LIKE '%bookings deleted=0 anonymized=2%'
              AND lower(coalesce(new_value, '') || coalesce(old_value, '')) NOT LIKE '%maria%'
            """, studio.tenantId)).isEqualTo(1);
    }

    @Test
    void anAddressNobodyHasIsAnEmptyReport() {
        List<ErasureOutcome> report = as(studio, () -> erasureService.erase("nobody@example.test", null));

        assertThat(report).noneMatch(ErasureOutcome::touchedAnything);
    }

    // ── fixtures ─────────────────────────────────────────────────────────────

    private record Studio(UUID tenantId, UUID ownerId) {
    }

    private record Fixture(UUID userId, UUID clientId, UUID linkedBookingId, UUID addressOnlyBookingId,
                           UUID galleryId, UUID signedContractId, UUID draftContractId, UUID invoiceId) {
    }

    private Fixture seedMaria(Studio s) {
        UUID userId = customer(s, MARIA);
        return inTenant(s, () -> {
            UUID clientId = insertClient(s, "Maria@Example.test", "Maria");
            insertLead(s, "Maria", MARIA);
            insertLead(s, "Maria", "MARIA@example.test");
            jdbc.update("INSERT INTO inquiry_requests (tenant_id, customer_id, event_type, budget_range, proposed_date)"
                + " VALUES (?, ?, 'WEDDING', '1000-2000', ?)", s.tenantId, userId, LocalDate.now().plusDays(60));

            UUID linked = insertBooking(s, "Maria", MARIA, userId, null);
            UUID addressOnly = insertBooking(s, "Maria", "MARIA@example.test", null, clientId);

            UUID galleryId = UUID.randomUUID();
            jdbc.update("INSERT INTO galleries (id, tenant_id, booking_id, access_token) VALUES (?, ?, ?, ?)",
                galleryId, s.tenantId, linked, "tok-" + galleryId);
            jdbc.update("INSERT INTO delivery_photos (tenant_id, gallery_id, r2_key, thumbnail_key)"
                + " VALUES (?, ?, 'maria/a.jpg', 'maria/thumb_a.jpg')", s.tenantId, galleryId);
            jdbc.update("INSERT INTO delivery_photos (tenant_id, gallery_id, r2_key) VALUES (?, ?, 'maria/b.jpg')",
                s.tenantId, galleryId);

            UUID signed = UUID.randomUUID();
            jdbc.update("""
                INSERT INTO contracts (id, tenant_id, booking_id, status, title, body, recipient_name,
                    recipient_email, sent_at, signed_at, signer_name, body_sha256)
                VALUES (?, ?, ?, 'SIGNED', 'Vertrag', 'Text', 'Maria', ?, now(), now(), 'Maria', ?)
                """, signed, s.tenantId, linked, MARIA, "a".repeat(64));
            UUID draft = UUID.randomUUID();
            jdbc.update("""
                INSERT INTO contracts (id, tenant_id, booking_id, status, title, body, recipient_name, recipient_email)
                VALUES (?, ?, ?, 'DRAFT', 'Entwurf', 'Text', 'Maria', ?)
                """, draft, s.tenantId, addressOnly, MARIA);

            UUID invoice = UUID.randomUUID();
            jdbc.update("""
                INSERT INTO invoices (id, tenant_id, booking_id, invoice_number, issue_year, sequence_number,
                    status, tax_mode, issuer_business_name, issuer_address_line1, issuer_postal_code,
                    issuer_city, issuer_country, buyer_name, buyer_email, subtotal_cents, tax_cents, total_cents)
                VALUES (?, ?, ?, ?, 2026, 1, 'ISSUED', 'KLEINUNTERNEHMER', 'Studio', 'Str. 1', '10115',
                    'Berlin', 'DE', 'Maria', ?, 150000, 0, 150000)
                """, invoice, s.tenantId, linked, "RE-" + invoice.toString().substring(0, 8), MARIA);

            jdbc.update("""
                INSERT INTO audit_log (tenant_id, action, entity_type, entity_id, old_value, new_value)
                VALUES (?, 'BOOKING_CLIENT_EMAIL_CHANGED', 'BOOKING', ?, 'maria.old@example.test', ?)
                """, s.tenantId, addressOnly, MARIA);

            return new Fixture(userId, clientId, linked, addressOnly, galleryId, signed, draft, invoice);
        });
    }

    private void seedBystanders() {
        UUID jonas = customer(studio, "jonas@example.test");
        inTenant(studio, () -> {
            insertClient(studio, "jonas@example.test", "Jonas");
            insertLead(studio, "Jonas", "jonas@example.test");
            insertBooking(studio, "Jonas", MARIA, jonas, null);
            return null;
        });
        inTenant(otherStudio, () -> {
            insertClient(otherStudio, MARIA, "Maria");
            insertLead(otherStudio, "Maria", MARIA);
            return null;
        });
    }

    private UUID insertClient(Studio s, String email, String name) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO clients (id, tenant_id, email, full_name) VALUES (?, ?, ?, ?)",
            id, s.tenantId, email, name);
        return id;
    }

    private void insertLead(Studio s, String name, String email) {
        jdbc.update("INSERT INTO leads (tenant_id, name, email, phone, message, ip_address)"
            + " VALUES (?, ?, ?, '+49 30 1234', 'Hochzeit im Mai', '198.51.100.7')", s.tenantId, name, email);
    }

    private UUID insertBooking(Studio s, String name, String email, UUID customerUserId, UUID clientId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO bookings (id, tenant_id, client_name, client_email, event_date, status,
                customer_user_id, client_id, location, internal_notes, total_amount_cents)
            VALUES (?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, 'Tiergarten', 'mag Schwarzweiß', 150000)
            """, id, s.tenantId, name, email, LocalDate.now().plusDays(30), customerUserId, clientId);
        return id;
    }

    private Studio createStudio() {
        UUID tenantId = new TransactionTemplate(txManager).execute(tx -> tenantRepository.save(
            new Tenant("erasure-" + UUID.randomUUID(), "owner-" + UUID.randomUUID() + "@example.test")).getId());
        UUID ownerId = inTenant(new Studio(tenantId, null), () -> {
            User owner = new User(tenantId, "owner-" + UUID.randomUUID() + "@example.test", "hash", "Anna");
            owner.setStaffRole(StaffRole.OWNER);
            return userRepository.save(owner).getId();
        });
        return new Studio(tenantId, ownerId);
    }

    private UUID customer(Studio s, String email) {
        return inTenant(s, () -> {
            User user = new User(s.tenantId, email, "hash", null);
            user.setRole("CUSTOMER");
            return userRepository.save(user).getId();
        });
    }

    private <T> T inTenant(Studio s, Supplier<T> action) {
        TenantContext.setTenant(s.tenantId.toString());
        try {
            return new TransactionTemplate(txManager).execute(tx -> action.get());
        } finally {
            TenantContext.clear();
        }
    }

    private <T> T as(Studio s, Supplier<T> action) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(s.ownerId.toString(), null, List.of()));
        TenantContext.setTenant(s.tenantId.toString());
        try {
            return action.get();
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    private long count(String sql, Object... params) {
        return countAcrossTenants(sql, params);
    }

    private static Map<String, ErasureOutcome> byCategory(List<ErasureOutcome> outcomes) {
        return outcomes.stream().collect(Collectors.toMap(ErasureOutcome::category, o -> o));
    }

    private static long awaitCount(LongSupplier count) {
        long seen = count.getAsLong();
        for (int i = 0; i < 50 && seen == 0; i++) {
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
            seen = count.getAsLong();
        }
        return seen;
    }
}
