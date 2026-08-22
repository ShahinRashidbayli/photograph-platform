package com.photographplatform.api.common.security;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.AccountReadOnlyException;
import com.photographplatform.api.entitlement.config.EntitlementProperties;
import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.payment.config.PaymentProperties;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.lang.reflect.Method;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.method.HandlerMethod;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The read-only lock's blast radius.
 *
 * <p>Most of these tests are about what the lock must NOT touch. Locking too
 * much is the more expensive mistake here: it can deadlock a photographer out
 * of the billing screen that would unlock them, stop a client paying an
 * invoice, or take a delivered gallery away from a couple who never agreed to
 * anything.
 */
class WriteAccessInterceptorTest {

    private static final OffsetDateTime NOW =
        OffsetDateTime.of(2026, 8, 22, 12, 0, 0, 0, ZoneOffset.UTC);
    private static final UUID TENANT_ID = UUID.randomUUID();

    private TenantRepository tenantRepository;
    private WriteAccessInterceptor interceptor;
    private Tenant tenant;

    @BeforeEach
    void setUp() {
        EntitlementProperties props = new EntitlementProperties();
        Map<Plan, EntitlementProperties.PlanConfig> tiers = new EnumMap<>(Plan.class);
        for (Plan plan : Plan.values()) {
            EntitlementProperties.PlanConfig config = new EntitlementProperties.PlanConfig();
            config.setCapabilities(EnumSet.noneOf(Capability.class));
            tiers.put(plan, config);
        }
        props.setTiers(tiers);

        tenantRepository = mock(TenantRepository.class);
        EntitlementService entitlements = new EntitlementService(
            props, new PaymentProperties(), tenantRepository,
            Clock.fixed(NOW.toInstant(), ZoneOffset.UTC));
        interceptor = new WriteAccessInterceptor(tenantRepository, entitlements);

        tenant = new Tenant("anna-foto", "anna@example.de");
        // Expired trial, no subscription — the locked state.
        tenant.setTrialEndsAt(NOW.minusDays(1));
        when(tenantRepository.findById(any())).thenReturn(Optional.of(tenant));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    private void authenticateAs(String role) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                UUID.randomUUID().toString(), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
        TenantContext.setTenant(TENANT_ID.toString());
    }

    private boolean preHandle(String httpMethod, Object handler) {
        MockHttpServletRequest request = new MockHttpServletRequest(httpMethod, "/api/bookings");
        return interceptor.preHandle(request, new MockHttpServletResponse(), handler);
    }

    // ── what it blocks ──────────────────────────────────────────────────

    @Test
    void aLapsedPhotographersWriteIsBlocked() {
        authenticateAs("PHOTOGRAPHER");
        for (String method : List.of("POST", "PUT", "PATCH", "DELETE")) {
            assertThatThrownBy(() -> preHandle(method, new Object()))
                .as("%s must be blocked for a lapsed account", method)
                .isInstanceOf(AccountReadOnlyException.class);
        }
    }

    // ── what it must not block ──────────────────────────────────────────

    @Test
    void readsAlwaysPassEvenWhenLocked() {
        authenticateAs("PHOTOGRAPHER");
        assertThat(preHandle("GET", new Object())).isTrue();
        assertThat(preHandle("HEAD", new Object())).isTrue();
        assertThat(preHandle("OPTIONS", new Object())).isTrue();
    }

    /**
     * A client paying an invoice or accepting a gallery is not the party being
     * billed. Blocking them would stop money coming in — the exact opposite of
     * what a billing lock is for.
     */
    @Test
    void aCustomersWriteIsNeverBlockedByThePhotographersBilling() {
        authenticateAs("CUSTOMER");
        assertThat(preHandle("POST", new Object())).isTrue();
    }

    /**
     * A visitor's enquiry on a lapsed photographer's public page still
     * submits. Those enquiries are the reason they might resubscribe.
     */
    @Test
    void unauthenticatedPublicWritesPassThrough() {
        assertThat(preHandle("POST", new Object())).isTrue();
    }

    @Test
    void anActiveAccountWritesFreely() {
        authenticateAs("PHOTOGRAPHER");
        tenant.setTrialEndsAt(NOW.plusDays(3));
        assertThat(preHandle("POST", new Object())).isTrue();
    }

    /**
     * The deadlock guard. Without the exemption the account can never be
     * unlocked: paying is a POST, POSTs are locked, so the photographer cannot
     * pay to stop being locked.
     */
    @Test
    void anExemptEndpointStaysReachableWhileLocked() throws Exception {
        authenticateAs("PHOTOGRAPHER");
        HandlerMethod handler = new HandlerMethod(new ExemptController(), exemptMethod());

        assertThatCode(() -> preHandle("POST", handler)).doesNotThrowAnyException();
    }

    @Test
    void aNonExemptHandlerMethodIsStillBlocked() throws Exception {
        authenticateAs("PHOTOGRAPHER");
        HandlerMethod handler = new HandlerMethod(new GatedController(), gatedMethod());

        assertThatThrownBy(() -> preHandle("POST", handler))
            .isInstanceOf(AccountReadOnlyException.class);
    }

    private Method exemptMethod() throws NoSuchMethodException {
        return ExemptController.class.getMethod("subscribe");
    }

    private Method gatedMethod() throws NoSuchMethodException {
        return GatedController.class.getMethod("createBooking");
    }

    @AllowedWhenReadOnly
    static class ExemptController {
        public void subscribe() {
        }
    }

    static class GatedController {
        public void createBooking() {
        }
    }
}
