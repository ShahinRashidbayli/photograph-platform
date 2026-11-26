package com.photographplatform.api.booking;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.StaffRole;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.booking.dto.CreateBookingRequest;
import com.photographplatform.api.booking.dto.UpdateBookingRequest;
import com.photographplatform.api.booking.service.BookingCommandService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.LocalDate;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The Customer's language on a booking the photographer types in and then
 * corrects: German by default, and an edit that changes it reaches the
 * {@code bookings.language} column, not only the response.
 */
class BookingLanguageIT extends IntegrationTestBase {

    @Autowired private BookingCommandService commandService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PlatformTransactionManager txManager;

    private static final LocalDate EVENT_DATE = LocalDate.now().plusDays(30);
    private static final String IP = "203.0.113.14";

    @Test
    void aManualBookingIsGermanAndAnEditMakesItEnglish() {
        Fixture studio = createTenant();

        BookingResponse created = asUser(studio, () -> commandService.createBooking(
            new CreateBookingRequest("Emma Clarke", "emma@example.test", EVENT_DATE,
                null, "WEDDING", "Berlin", null, null, 50_000, null, null, null, null, null),
            IP));
        assertThat(created.language()).isEqualTo("de");
        assertThat(storedLanguage(created.id())).isEqualTo("de");

        BookingResponse updated = asUser(studio, () -> commandService.updateBooking(created.id(),
            new UpdateBookingRequest("Emma Clarke", "emma@example.test", EVENT_DATE,
                null, "WEDDING", "Berlin", null, 50_000, null, null, null, null, "en"),
            IP));

        assertThat(updated.language()).isEqualTo("en");
        assertThat(storedLanguage(created.id())).isEqualTo("en");
    }

    private String storedLanguage(UUID bookingId) {
        return valueAcrossTenants("SELECT language FROM bookings WHERE id = ?", bookingId);
    }

    private Fixture createTenant() {
        UUID tenantId = new TransactionTemplate(txManager).execute(s -> tenantRepository.save(
            new Tenant("language-test-" + UUID.randomUUID(),
                "owner-" + UUID.randomUUID() + "@example.test")).getId());
        TenantContext.setTenant(tenantId.toString());
        try {
            UUID photographer = new TransactionTemplate(txManager).execute(s -> {
                User staff = new User(tenantId, "photographer-" + UUID.randomUUID() + "@example.test",
                    "hash", "Anna");
                staff.setStaffRole(StaffRole.OWNER);
                return userRepository.save(staff).getId();
            });
            return new Fixture(tenantId, photographer);
        } finally {
            TenantContext.clear();
        }
    }

    private <T> T asUser(Fixture studio, Supplier<T> action) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(studio.photographer().toString(), null));
        TenantContext.setTenant(studio.tenantId().toString());
        try {
            return action.get();
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    private record Fixture(UUID tenantId, UUID photographer) { }
}
