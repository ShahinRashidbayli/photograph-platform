package com.photographplatform.api.auth;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.inquiry.domain.InquiryRequest;
import com.photographplatform.api.inquiry.repository.InquiryRequestRepository;
import com.photographplatform.api.lead.domain.Lead;
import com.photographplatform.api.lead.repository.LeadRepository;
import com.photographplatform.api.portfolio.domain.Category;
import com.photographplatform.api.portfolio.domain.Photo;
import com.photographplatform.api.portfolio.repository.CategoryRepository;
import com.photographplatform.api.portfolio.repository.PhotoRepository;
import com.photographplatform.api.pricing.domain.Package;
import com.photographplatform.api.pricing.repository.PackageRepository;
import com.photographplatform.api.resource.domain.BookingResource;
import com.photographplatform.api.resource.domain.StudioResource;
import com.photographplatform.api.resource.repository.BookingResourceRepository;
import com.photographplatform.api.resource.repository.StudioResourceRepository;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves Postgres RLS (see {@code V11__tenant_rls.sql}) actually isolates the
 * 9 tables that used to live in per-tenant schemas — the check {@code
 * TenantIsolationIT} deferred as "Sprint 2, once those endpoints exist".
 *
 * <p>Every table is exercised through its real repository/entity (never a raw
 * JDBC connection bypassing the managed one), with the app's runtime role
 * ({@code fotolio_app} — see {@link IntegrationTestBase#containerProperties})
 * so the test fails if either the RLS policies or the role wiring regress.
 * For each table: one row is created under Tenant A, one under Tenant B, and
 * then — with only Tenant A's context bound — a direct by-id lookup of
 * Tenant B's row must come back empty, and the visible row count must be
 * exactly one.
 *
 * <p>Deliberately NOT {@code @Transactional} at the test-method level: each
 * repository call needs its own fresh transaction so {@link
 * com.photographplatform.api.common.config.TenantRoutingDataSource} re-applies
 * the {@code app.tenant_id} GUC for the tenant in context at that moment. A
 * shared enclosing transaction would bind the GUC once, from whichever
 * tenant happened to be current when the first statement ran, and every
 * later {@code TenantContext.setTenant(...)} switch in the test would
 * silently do nothing.
 */
class RlsCrossTenantIsolationIT extends IntegrationTestBase {

    @Autowired private TenantRepository tenantRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private PackageRepository packageRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private LeadRepository leadRepository;
    @Autowired private GalleryRepository galleryRepository;
    @Autowired private DeliveryPhotoRepository deliveryPhotoRepository;
    @Autowired private InquiryRequestRepository inquiryRequestRepository;
    @Autowired private StudioResourceRepository studioResourceRepository;
    @Autowired private BookingResourceRepository bookingResourceRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private PlatformTransactionManager txManager;

    @Test
    void eachTenantScopedTableIsIsolatedByRls() {
        UUID tenantA = tenantRepository.save(new Tenant("rls-a", "a@rls-test.example")).getId();
        UUID tenantB = tenantRepository.save(new Tenant("rls-b", "b@rls-test.example")).getId();

        UUID categoryA = as(tenantA, () -> categoryRepository.save(withTenant(new Category("Cat A"), tenantA)).getId());
        UUID categoryB = as(tenantB, () -> categoryRepository.save(withTenant(new Category("Cat B"), tenantB)).getId());
        assertIsolated(categoryRepository, tenantA, categoryA, tenantB, categoryB);

        UUID photoA = as(tenantA, () -> photoRepository.save(withTenant(new Photo("a/1.jpg", null), tenantA)).getId());
        UUID photoB = as(tenantB, () -> photoRepository.save(withTenant(new Photo("b/1.jpg", null), tenantB)).getId());
        assertIsolated(photoRepository, tenantA, photoA, tenantB, photoB);

        // Client has no accessible constructor and no repository-level create
        // path yet (see client/domain/Client.java) — inserted via the managed
        // EntityManager rather than a bypassing raw JDBC connection, so it
        // still goes through TenantRoutingDataSource / RLS like everything else.
        UUID clientA = as(tenantA, () -> insertClient(tenantA, "a@client.example"));
        UUID clientB = as(tenantB, () -> insertClient(tenantB, "b@client.example"));
        assertIsolated(clientA, clientB, tenantA, tenantB);

        UUID packageA = as(tenantA, () -> packageRepository.save(
            withTenant(new Package("Pkg A", 10_000), tenantA)).getId());
        UUID packageB = as(tenantB, () -> packageRepository.save(
            withTenant(new Package("Pkg B", 20_000), tenantB)).getId());
        assertIsolated(packageRepository, tenantA, packageA, tenantB, packageB);

        UUID bookingA = as(tenantA, () -> bookingRepository.save(
            withTenant(new Booking("Client A", "a@booking.example", LocalDate.now().plusDays(30)), tenantA)).getId());
        UUID bookingB = as(tenantB, () -> bookingRepository.save(
            withTenant(new Booking("Client B", "b@booking.example", LocalDate.now().plusDays(30)), tenantB)).getId());
        assertIsolated(bookingRepository, tenantA, bookingA, tenantB, bookingB);

        UUID leadA = as(tenantA, () -> leadRepository.save(
            withTenant(new Lead("Lead A", "a@lead.example", null, null, null, null, null, "203.0.113.1"), tenantA))
            .getId());
        UUID leadB = as(tenantB, () -> leadRepository.save(
            withTenant(new Lead("Lead B", "b@lead.example", null, null, null, null, null, "203.0.113.2"), tenantB))
            .getId());
        assertIsolated(leadRepository, tenantA, leadA, tenantB, leadB);

        UUID galleryA = as(tenantA, () -> galleryRepository.save(
            withTenant(new Gallery(null, OffsetDateTime.now(), 90, true, false), tenantA)).getId());
        UUID galleryB = as(tenantB, () -> galleryRepository.save(
            withTenant(new Gallery(null, OffsetDateTime.now(), 90, true, false), tenantB)).getId());
        assertIsolated(galleryRepository, tenantA, galleryA, tenantB, galleryB);

        UUID deliveryPhotoA = as(tenantA, () -> deliveryPhotoRepository.save(
            withTenant(new DeliveryPhoto(galleryA, "a/delivery-1.jpg", "wedding.jpg"), tenantA)).getId());
        UUID deliveryPhotoB = as(tenantB, () -> deliveryPhotoRepository.save(
            withTenant(new DeliveryPhoto(galleryB, "b/delivery-1.jpg", "wedding.jpg"), tenantB)).getId());
        assertIsolated(deliveryPhotoRepository, tenantA, deliveryPhotoA, tenantB, deliveryPhotoB);

        UUID inquiryA = as(tenantA, () -> inquiryRequestRepository.save(withTenant(new InquiryRequest(
            UUID.randomUUID(), "HOCHZEIT", "OVER_2000", LocalDate.now().plusDays(60),
            "Berlin", "Hi", "HIGH", "BIO_LINK"), tenantA)).getId());
        UUID inquiryB = as(tenantB, () -> inquiryRequestRepository.save(withTenant(new InquiryRequest(
            UUID.randomUUID(), "HOCHZEIT", "OVER_2000", LocalDate.now().plusDays(60),
            "Munich", "Hi", "HIGH", "BIO_LINK"), tenantB)).getId());
        assertIsolated(inquiryRequestRepository, tenantA, inquiryA, tenantB, inquiryB);

        UUID resourceA = as(tenantA, () -> studioResourceRepository.save(
            new StudioResource(tenantA, "Studio A", "ROOM")).getId());
        UUID resourceB = as(tenantB, () -> studioResourceRepository.save(
            new StudioResource(tenantB, "Studio B", "ROOM")).getId());
        assertIsolated(studioResourceRepository, tenantA, resourceA, tenantB, resourceB);

        // booking_resources is the one table here with no tenant_id of its own:
        // its policy is an EXISTS against the parent booking (V28). That is a
        // different shape of rule from every other policy in this schema, so it
        // is the one most worth proving rather than assuming.
        as(tenantA, () -> bookingResourceRepository.save(new BookingResource(bookingA, resourceA)));
        as(tenantB, () -> bookingResourceRepository.save(new BookingResource(bookingB, resourceB)));
        assertBookingResourceIsolated(bookingA, bookingB, tenantA, tenantB);
    }

    /**
     * booking_resources has a composite key and no tenant column, so neither
     * generic helper fits: visibility is asserted through the link's own
     * columns.
     */
    private void assertBookingResourceIsolated(
        UUID ownBookingId, UUID otherBookingId, UUID tenantA, UUID tenantB) {
        assertThat((Long) as(tenantA, this::countBookingResources)).isEqualTo(1L);
        assertThat((Boolean) as(tenantA, () -> bookingResourceVisible(otherBookingId))).isFalse();
        assertThat((Boolean) as(tenantA, () -> bookingResourceVisible(ownBookingId))).isTrue();

        assertThat((Long) as(tenantB, this::countBookingResources)).isEqualTo(1L);
        assertThat((Boolean) as(tenantB, () -> bookingResourceVisible(ownBookingId))).isFalse();
        assertThat((Boolean) as(tenantB, () -> bookingResourceVisible(otherBookingId))).isTrue();
    }

    private Long countBookingResources() {
        return ((Number) entityManager
            .createNativeQuery("SELECT count(*) FROM booking_resources")
            .getSingleResult()).longValue();
    }

    private Boolean bookingResourceVisible(UUID bookingId) {
        return !entityManager
            .createNativeQuery("SELECT booking_id FROM booking_resources WHERE booking_id = ?")
            .setParameter(1, bookingId)
            .getResultList()
            .isEmpty();
    }

    /** Runs {@code action} in its own fresh transaction, bound to {@code tenantId}. */
    private <T> T as(UUID tenantId, Supplier<T> action) {
        TenantContext.setTenant(tenantId.toString());
        try {
            return new TransactionTemplate(txManager).execute(status -> action.get());
        } finally {
            TenantContext.clear();
        }
    }

    private UUID insertClient(UUID tenantId, String email) {
        UUID id = UUID.randomUUID();
        entityManager.createNativeQuery(
                "INSERT INTO clients (id, tenant_id, email, full_name) VALUES (?, ?, ?, ?)")
            .setParameter(1, id)
            .setParameter(2, tenantId)
            .setParameter(3, email)
            .setParameter(4, "Test Client")
            .executeUpdate();
        return id;
    }

    /** Client-specific variant: no JpaRepository exists to drive the generic helper below. */
    private void assertIsolated(UUID ownId, UUID otherId, UUID tenantA, UUID tenantB) {
        assertThat((Long) as(tenantA, () -> countClients())).isEqualTo(1L);
        assertThat((Boolean) as(tenantA, () -> clientVisible(otherId))).isFalse();
        assertThat((Boolean) as(tenantA, () -> clientVisible(ownId))).isTrue();

        assertThat((Long) as(tenantB, () -> countClients())).isEqualTo(1L);
        assertThat((Boolean) as(tenantB, () -> clientVisible(ownId))).isFalse();
        assertThat((Boolean) as(tenantB, () -> clientVisible(otherId))).isTrue();
    }

    private Long countClients() {
        return ((Number) entityManager.createNativeQuery("SELECT count(*) FROM clients").getSingleResult()).longValue();
    }

    private Boolean clientVisible(UUID id) {
        return !entityManager.createNativeQuery("SELECT id FROM clients WHERE id = ?")
            .setParameter(1, id)
            .getResultList()
            .isEmpty();
    }

    private static <T> T withTenant(T entity, UUID tenantId) {
        if (entity instanceof Category e) {
            e.setTenantId(tenantId);
        } else if (entity instanceof Photo e) {
            e.setTenantId(tenantId);
        } else if (entity instanceof Package e) {
            e.setTenantId(tenantId);
        } else if (entity instanceof Booking e) {
            e.setTenantId(tenantId);
        } else if (entity instanceof Lead e) {
            e.setTenantId(tenantId);
        } else if (entity instanceof Gallery e) {
            e.setTenantId(tenantId);
        } else if (entity instanceof DeliveryPhoto e) {
            e.setTenantId(tenantId);
        } else if (entity instanceof InquiryRequest e) {
            e.setTenantId(tenantId);
        } else {
            throw new IllegalArgumentException("Unsupported entity: " + entity.getClass());
        }
        return entity;
    }

    /**
     * With only {@code tenantA} bound: {@code otherId} (created under a
     * different tenant) must be invisible by direct lookup, and the total
     * row count across both tenants (2) must collapse to exactly 1 — the
     * caller's own row. Repeated symmetrically for {@code tenantB}.
     */
    private void assertIsolated(
        JpaRepository<?, UUID> repo, UUID tenantA, UUID ownId, UUID tenantB, UUID otherId
    ) {
        assertThat((Boolean) as(tenantA, () -> repo.findById(ownId).isPresent())).isTrue();
        assertThat((Boolean) as(tenantA, () -> repo.findById(otherId).isPresent())).isFalse();
        assertThat((Long) as(tenantA, repo::count)).isEqualTo(1L);

        assertThat((Boolean) as(tenantB, () -> repo.findById(otherId).isPresent())).isTrue();
        assertThat((Boolean) as(tenantB, () -> repo.findById(ownId).isPresent())).isFalse();
        assertThat((Long) as(tenantB, repo::count)).isEqualTo(1L);
    }
}
