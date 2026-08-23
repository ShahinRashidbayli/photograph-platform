package com.photographplatform.api.billing;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.billing.config.BillingProperties;
import com.photographplatform.api.billing.dto.StartCheckoutRequest;
import com.photographplatform.api.billing.service.BillingService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.UpstreamServiceException;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.stripe.StripeClient;
import com.stripe.exception.ApiConnectionException;
import com.stripe.model.Customer;
import com.stripe.service.CustomerService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The Stripe customer lifecycle, which had no test at all.
 *
 * <p>{@code ensureCustomer} was restructured so the {@code customers.create}
 * round-trip no longer runs inside a transaction — the pool-exhaustion problem
 * the audit raised. That restructure introduced a window that did not exist
 * before: between reading "no customer yet" and writing the new id, another
 * checkout can finish and store one. Getting that wrong splits a photographer's
 * billing history across two Stripe customers, which is not recoverable from
 * inside the product.
 *
 * <p>The class sat at roughly 10% line coverage while carrying that change, so
 * these tests exist to cover the branch the restructure created rather than to
 * raise a number.
 */
class BillingServiceTest {

    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID ACTOR_ID = UUID.randomUUID();
    private static final Clock FIXED_CLOCK =
        Clock.fixed(Instant.parse("2026-03-01T12:00:00Z"), ZoneOffset.UTC);

    private TenantRepository tenantRepository;
    private AuditService auditService;
    private StripeClient stripeClient;
    private CustomerService customerService;
    private Tenant tenant;

    @BeforeEach
    void setUp() {
        tenantRepository = mock(TenantRepository.class);
        auditService = mock(AuditService.class);
        stripeClient = mock(StripeClient.class);
        customerService = mock(CustomerService.class);
        when(stripeClient.customers()).thenReturn(customerService);

        tenant = new Tenant("anna-foto", "anna@example.test");
        // require() is a default method on the interface, and Mockito stubs
        // default methods rather than running them — so it has to be stubbed
        // directly, not left to fall through to findById().
        when(tenantRepository.require(TENANT_ID)).thenReturn(tenant);
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant));
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(inv -> inv.getArgument(0));

        TenantContext.setTenant(TENANT_ID.toString());
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(ACTOR_ID.toString(), null));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    /**
     * The branch the restructure created. Another checkout stored a customer
     * while this one was waiting on Stripe; that customer must win, and the one
     * just created must be discarded rather than overwriting it.
     */
    @Test
    @DisplayName("a customer stored while we were at Stripe wins over the one we just created")
    void concurrentCheckoutKeepsTheFirstStoredCustomer() throws Exception {
        BillingService service = serviceWithStripe();

        Customer created = new Customer();
        created.setId("cus_ours");
        when(customerService.create(any(com.stripe.param.CustomerCreateParams.class)))
            .thenAnswer(inv -> {
                // Simulates the other request committing while this one is at
                // Stripe — the whole point of moving the call out of the
                // transaction is that this is now possible.
                tenant.setStripeCustomerId("cus_theirs");
                return created;
            });

        assertThatThrownBy(() -> service.startCheckout(
                new StartCheckoutRequest("PRO", "MONTHLY"), "203.0.113.5"))
            .isInstanceOf(RuntimeException.class);

        // Whatever happened to the checkout session afterwards, the stored
        // customer must still be the one that got there first.
        assertThat(tenant.getStripeCustomerId()).isEqualTo("cus_theirs");
        verify(auditService, never()).log(
            any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("an existing customer is reused rather than recreated")
    void existingCustomerIsReused() throws Exception {
        tenant.setStripeCustomerId("cus_existing");
        BillingService service = serviceWithStripe();

        assertThatThrownBy(() -> service.startCheckout(
                new StartCheckoutRequest("PRO", "MONTHLY"), "203.0.113.5"))
            .isInstanceOf(RuntimeException.class);

        // One photographer, one billing history: Stripe must not be asked for
        // a second customer.
        verify(customerService, never()).create(any(com.stripe.param.CustomerCreateParams.class));
        assertThat(tenant.getStripeCustomerId()).isEqualTo("cus_existing");
    }

    /**
     * A Stripe failure has to surface as a bad gateway carrying our own wording
     * — the provider's message names account ids and API versions that have no
     * business reaching a photographer's browser.
     */
    @Test
    @DisplayName("a Stripe outage becomes an upstream error, not a 500")
    void stripeFailureBecomesUpstreamError() throws Exception {
        BillingService service = serviceWithStripe();
        when(customerService.create(any(com.stripe.param.CustomerCreateParams.class)))
            .thenThrow(new ApiConnectionException("connection reset"));

        assertThatThrownBy(() -> service.startCheckout(
                new StartCheckoutRequest("PRO", "MONTHLY"), "203.0.113.5"))
            .isInstanceOf(UpstreamServiceException.class)
            .hasMessageContaining("try again");

        assertThat(tenant.getStripeCustomerId()).isNull();
    }

    /**
     * Running without Stripe is a supported configuration (bank transfer only),
     * so this is a 409 the frontend can explain — not a server fault.
     */
    @Test
    @DisplayName("no Stripe configured is a conflict, not a crash")
    void withoutStripeCheckoutIsRefusedCleanly() {
        BillingService service = service(Optional.empty());

        assertThatThrownBy(() -> service.startCheckout(
                new StartCheckoutRequest("PRO", "MONTHLY"), "203.0.113.5"))
            .isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("the billing portal refuses cleanly before there is anything to manage")
    void portalWithoutACustomerIsRefused() {
        BillingService service = serviceWithStripe();

        assertThatThrownBy(service::openPortal)
            .isInstanceOf(ConflictException.class)
            .hasMessageContaining("Choose a plan first");
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private BillingService serviceWithStripe() {
        return service(Optional.of(stripeClient));
    }

    private BillingService service(Optional<StripeClient> client) {
        return new BillingService(
            client,
            tenantRepository,
            mock(EntitlementService.class),
            billingProperties(),
            auditService,
            immediateTransactionManager(),
            FIXED_CLOCK);
    }

    /** Prices for every tier, so price lookup is never the reason a test fails. */
    private BillingProperties billingProperties() {
        BillingProperties props = new BillingProperties();
        props.setTrialDays(14);
        Map<Plan, BillingProperties.PlanPrices> prices = new EnumMap<>(Plan.class);
        for (Plan plan : Plan.values()) {
            BillingProperties.PlanPrices tier = new BillingProperties.PlanPrices();
            tier.setMonthly("price_" + plan.name().toLowerCase(java.util.Locale.ROOT) + "_m");
            tier.setYearly("price_" + plan.name().toLowerCase(java.util.Locale.ROOT) + "_y");
            prices.put(plan, tier);
        }
        props.setPrices(prices);
        return props;
    }

    /**
     * Runs each callback inline. The production code drives transactions by
     * hand precisely so the Stripe call sits outside one; a real transaction
     * manager would add a database this test does not need and would hide the
     * ordering being asserted.
     */
    private PlatformTransactionManager immediateTransactionManager() {
        return new PlatformTransactionManager() {
            @Override
            public TransactionStatus getTransaction(
                org.springframework.transaction.TransactionDefinition definition) {
                return new SimpleTransactionStatus();
            }

            @Override
            public void commit(TransactionStatus status) {
                // nothing to commit — the mocks record the writes
            }

            @Override
            public void rollback(TransactionStatus status) {
                // nothing to roll back
            }
        };
    }
}
