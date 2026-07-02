package com.photographplatform.api.pricing;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.pricing.domain.Package;
import com.photographplatform.api.pricing.dto.PackageRequest;
import com.photographplatform.api.pricing.dto.PackageResponse;
import com.photographplatform.api.pricing.repository.PackageRepository;
import com.photographplatform.api.pricing.service.PackageService;
import java.math.BigDecimal;
import java.util.List;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * CRUD behaviour for the package catalog. The tests pin the contract the
 * booking flow depends on: a package always has a price in cents, currency
 * defaults to EUR, deactivation is via {@code active=false} (not delete).
 */
class PackageServiceTest {

    private static final UUID ACTOR_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final String IP = "1.2.3.4";

    private PackageRepository packageRepository;
    private AuditService auditService;
    private PackageService packageService;

    @BeforeEach
    void setUp() {
        packageRepository = mock(PackageRepository.class);
        auditService = mock(AuditService.class);
        packageService = new PackageService(packageRepository, auditService);

        // Authenticate as the photographer so currentUserId() resolves — the
        // audit row must record *who* mutated pricing. The tenant id is read
        // from TenantContext (set from the JWT claim in production), so pin it
        // here rather than mocking a User→tenant lookup.
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(ACTOR_ID.toString(), null)
        );
        TenantContext.setTenant(TENANT_ID.toString());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void createPersistsPackageWithEurDefault() {
        when(packageRepository.save(org.mockito.ArgumentMatchers.any(Package.class)))
            .thenAnswer(inv -> inv.getArgument(0));

        PackageRequest req = new PackageRequest(
            "  Standard wedding  ", 180000, null,
            new BigDecimal("8.0"), 300, true, 10
        );

        PackageResponse result = packageService.create(req, IP);

        ArgumentCaptor<Package> captor = ArgumentCaptor.forClass(Package.class);
        verify(packageRepository).save(captor.capture());
        Package saved = captor.getValue();

        // Name is trimmed, price stored as cents, currency falls back to EUR
        // when omitted — the booking flow relies on these defaults to render
        // prices without a separate "what currency?" round-trip.
        assertThat(saved.getName()).isEqualTo("Standard wedding");
        assertThat(saved.getPriceCents()).isEqualTo(180000);
        assertThat(saved.getCurrency()).isEqualTo("EUR");
        assertThat(saved.isActive()).isTrue();
        assertThat(saved.getSortOrder()).isEqualTo(10);
        assertThat(result.priceCents()).isEqualTo(180000);
    }

    @Test
    void createUppercasesCurrency() {
        when(packageRepository.save(org.mockito.ArgumentMatchers.any(Package.class)))
            .thenAnswer(inv -> inv.getArgument(0));

        packageService.create(new PackageRequest("Tier 2", 50000, "chf", null, null, null, null), IP);

        ArgumentCaptor<Package> captor = ArgumentCaptor.forClass(Package.class);
        verify(packageRepository).save(captor.capture());
        assertThat(captor.getValue().getCurrency()).isEqualTo("CHF");
    }

    @Test
    void updateOverwritesAllFields() {
        UUID id = UUID.randomUUID();
        Package existing = new Package("Old", 100000);
        existing.setSortOrder(0);
        when(packageRepository.findById(id)).thenReturn(Optional.of(existing));

        PackageRequest req = new PackageRequest("New", 200000, "USD",
            new BigDecimal("4.5"), 150, false, 7);

        PackageResponse result = packageService.update(id, req, IP);

        // Dirty checking saves the entity at TX commit — we just need the
        // in-memory mutation to reflect the request, no explicit save() call.
        assertThat(existing.getName()).isEqualTo("New");
        assertThat(existing.getPriceCents()).isEqualTo(200000);
        assertThat(existing.getCurrency()).isEqualTo("USD");
        assertThat(existing.isActive()).isFalse();
        assertThat(existing.getSortOrder()).isEqualTo(7);
        assertThat(result.priceCents()).isEqualTo(200000);
    }

    @Test
    void updateUnknownIdThrowsNotFound() {
        UUID missing = UUID.randomUUID();
        when(packageRepository.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> packageService.update(missing,
            new PackageRequest("x", 1, null, null, null, null, null), IP)
        ).isInstanceOf(NotFoundException.class);
    }

    @Test
    void listActiveOnlyHitsTheActiveOnlyQuery() {
        when(packageRepository.findByActiveTrueOrderBySortOrderAscNameAsc())
            .thenReturn(List.of(new Package("Active", 1000)));

        packageService.listAll(true);

        verify(packageRepository, times(1)).findByActiveTrueOrderBySortOrderAscNameAsc();
        verify(packageRepository, times(0)).findAllByOrderBySortOrderAscNameAsc();
    }

    @Test
    void listAllHitsTheAllQuery() {
        when(packageRepository.findAllByOrderBySortOrderAscNameAsc())
            .thenReturn(List.of());

        packageService.listAll(false);

        verify(packageRepository, times(1)).findAllByOrderBySortOrderAscNameAsc();
        verify(packageRepository, times(0)).findByActiveTrueOrderBySortOrderAscNameAsc();
    }

    @Test
    void deleteUnknownIdThrowsNotFound() {
        UUID missing = UUID.randomUUID();
        when(packageRepository.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> packageService.delete(missing, IP))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void createEmitsAuditWithNewPriceInNewValue() {
        when(packageRepository.save(any(Package.class)))
            .thenAnswer(inv -> {
                Package p = inv.getArgument(0);
                // Simulate the JPA-assigned id so the audit row references the saved entity.
                try {
                    var field = Package.class.getDeclaredField("id");
                    field.setAccessible(true);
                    field.set(p, UUID.randomUUID());
                } catch (ReflectiveOperationException e) {
                    throw new IllegalStateException(e);
                }
                return p;
            });

        PackageResponse created = packageService.create(
            new PackageRequest("Standard", 180000, null, null, null, null, null), IP);

        verify(auditService).log(
            eq("PACKAGE_CREATED"),
            eq("PACKAGE"),
            eq(created.id()),
            eq(TENANT_ID),
            eq(ACTOR_ID),
            eq(IP),
            eq((String) null),
            eq("180000")
        );
    }

    @Test
    void updateEmitsAuditWithOldAndNewPrice() {
        UUID id = UUID.randomUUID();
        Package existing = new Package("Old", 100000);
        when(packageRepository.findById(id)).thenReturn(Optional.of(existing));

        packageService.update(id, new PackageRequest("New", 250000, null, null, null, null, null), IP);

        // Old/new price as strings let a future audit reader reconstruct the
        // pricing timeline without joining other tables.
        verify(auditService).log(
            eq("PACKAGE_UPDATED"),
            eq("PACKAGE"),
            eq(id),
            eq(TENANT_ID),
            eq(ACTOR_ID),
            eq(IP),
            eq("100000"),
            eq("250000")
        );
    }

    @Test
    void deleteEmitsAuditWithOldPriceAndRemovesPackage() {
        UUID id = UUID.randomUUID();
        Package existing = new Package("Standard", 180000);
        when(packageRepository.findById(id)).thenReturn(Optional.of(existing));

        packageService.delete(id, IP);

        verify(packageRepository, times(1)).delete(existing);
        verify(auditService).log(
            eq("PACKAGE_DELETED"),
            eq("PACKAGE"),
            eq(id),
            eq(TENANT_ID),
            eq(ACTOR_ID),
            eq(IP),
            eq("180000"),
            eq((String) null)
        );
    }
}
