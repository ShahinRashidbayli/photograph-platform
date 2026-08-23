package com.photographplatform.api.billing;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.billing.config.BillingProperties;
import com.photographplatform.api.common.cache.GateCache;
import com.photographplatform.api.billing.service.BillingWebhookService;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.payment.repository.ProcessedStripeEventRepository;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.SubscriptionStatus;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Subscription webhooks — the only path that may change a tenant's plan.
 *
 * <p>Driven through real signed payloads rather than mocked {@code Event}
 * objects, so the signature check, the API-version deserialization fallback and
 * the item-level {@code current_period_end} are all actually exercised. Those
 * three are where this kind of code goes wrong quietly: each one fails by doing
 * nothing rather than by throwing.
 */
class BillingWebhookServiceTest {

    private static final String SECRET = "whsec_test_secret";
    private static final String PRICE_PRO_MONTHLY = "price_pro_monthly";
    private static final String PRICE_STUDIO_YEARLY = "price_studio_yearly";
    private static final long PERIOD_END = 1_790_000_000L;

    private TenantRepository tenantRepository;
    private ProcessedStripeEventRepository processedEvents;
    private AuditService auditService;
    private BillingWebhookService service;
    private Tenant tenant;
    private UUID tenantId;

    @BeforeEach
    void setUp() {
        tenantRepository = mock(TenantRepository.class);
        processedEvents = mock(ProcessedStripeEventRepository.class);
        auditService = mock(AuditService.class);

        BillingProperties properties = new BillingProperties();
        properties.setWebhookSecret(SECRET);
        properties.setPrices(prices());

        service = new BillingWebhookService(
            tenantRepository, processedEvents, properties, auditService, mock(GateCache.class));

        tenant = new Tenant("anna-foto", "anna@example.de");
        tenantId = UUID.randomUUID();
        ReflectionTestUtils.setField(tenant, "id", tenantId);
        tenant.setPlan(Plan.STARTER);

        when(processedEvents.tryClaim(anyString())).thenReturn(1);
        when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
        when(tenantRepository.findByStripeCustomerId(anyString())).thenReturn(Optional.empty());
    }

    private Map<Plan, BillingProperties.PlanPrices> prices() {
        Map<Plan, BillingProperties.PlanPrices> map = new EnumMap<>(Plan.class);
        map.put(Plan.STARTER, planPrices("price_starter_monthly", "price_starter_yearly"));
        map.put(Plan.PRO, planPrices(PRICE_PRO_MONTHLY, "price_pro_yearly"));
        map.put(Plan.STUDIO, planPrices("price_studio_monthly", PRICE_STUDIO_YEARLY));
        return map;
    }

    private BillingProperties.PlanPrices planPrices(String monthly, String yearly) {
        BillingProperties.PlanPrices p = new BillingProperties.PlanPrices();
        p.setMonthly(monthly);
        p.setYearly(yearly);
        return p;
    }

    private void deliver(String payload) {
        service.handle(payload, StripeEventFixture.signature(payload, SECRET));
    }

    private String event(String type, String priceId, String status, String tenantIdValue) {
        return StripeEventFixture.subscriptionEvent(
            "evt_" + UUID.randomUUID(), type, "sub_123", "cus_123",
            tenantIdValue, priceId, status, PERIOD_END);
    }

    // ── the happy path ──────────────────────────────────────────────────

    /**
     * The plan comes from what the customer actually pays for — never from the
     * registration request, which is what RegisterRequest's javadoc warned
     * about ("must come from a paid subscription, never from this field").
     */
    @Test
    void anActiveSubscriptionSetsThePlanFromThePriceItIsOn() {
        deliver(event("customer.subscription.updated", PRICE_PRO_MONTHLY, "active",
            tenantId.toString()));

        assertThat(tenant.plan()).isEqualTo(Plan.PRO);
        assertThat(tenant.getSubscriptionStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(tenant.getStripeSubscriptionId()).isEqualTo("sub_123");
        verify(tenantRepository).save(tenant);
    }

    /**
     * current_period_end lives on the subscription ITEM in this API version —
     * {@code Subscription} has no such accessor at all. Reading it from the
     * wrong level yields null, which reads as "no paid period" and would lock a
     * paying customer out the moment their trial ended.
     */
    @Test
    void thePaidPeriodIsReadFromTheSubscriptionItem() {
        deliver(event("customer.subscription.updated", PRICE_PRO_MONTHLY, "active",
            tenantId.toString()));

        assertThat(tenant.getCurrentPeriodEnd())
            .isEqualTo(OffsetDateTime.parse("2026-09-21T14:13:20Z"));
    }

    @Test
    void aYearlyPriceResolvesToTheSameTierAsItsMonthlyTwin() {
        deliver(event("customer.subscription.updated", PRICE_STUDIO_YEARLY, "active",
            tenantId.toString()));

        assertThat(tenant.plan()).isEqualTo(Plan.STUDIO);
    }

    @Test
    void aDeletedSubscriptionCancelsRegardlessOfTheStatusStripeSends() {
        // Stripe sends the subscription's last status on the delete event,
        // which can still read "active". The event is the fact.
        deliver(event("customer.subscription.deleted", PRICE_PRO_MONTHLY, "active",
            tenantId.toString()));

        assertThat(tenant.getSubscriptionStatus()).isEqualTo(SubscriptionStatus.CANCELED);
    }

    @Test
    void pastDueIsCarriedThroughSoTheAccountKeepsWorkingWhileStripeRetries() {
        deliver(event("customer.subscription.updated", PRICE_PRO_MONTHLY, "past_due",
            tenantId.toString()));

        assertThat(tenant.getSubscriptionStatus()).isEqualTo(SubscriptionStatus.PAST_DUE);
        assertThat(tenant.hasActiveSubscription()).isTrue();
    }

    // ── authentication ──────────────────────────────────────────────────

    /**
     * The endpoint is public and unauthenticated; this check is the only thing
     * standing between an attacker and a free STUDIO plan.
     */
    @Test
    void aPayloadWithAForgedSignatureIsRejected() {
        String payload = event("customer.subscription.updated", PRICE_STUDIO_YEARLY, "active",
            tenantId.toString());

        assertThatThrownBy(() ->
            service.handle(payload, StripeEventFixture.signature(payload, "whsec_wrong_secret")))
            .isInstanceOf(ConflictException.class);

        assertThat(tenant.plan()).isEqualTo(Plan.STARTER);
        verify(tenantRepository, never()).save(any());
    }

    @Test
    void anUnconfiguredWebhookSecretRefusesToProcessAnything() {
        BillingProperties noSecret = new BillingProperties();
        noSecret.setPrices(prices());
        BillingWebhookService unconfigured = new BillingWebhookService(
            tenantRepository, processedEvents, noSecret, auditService, mock(GateCache.class));

        assertThatThrownBy(() -> unconfigured.handle("{}", "t=1,v1=abc"))
            .isInstanceOf(IllegalStateException.class);
    }

    // ── idempotency ─────────────────────────────────────────────────────

    /**
     * Stripe documents that the same event can be delivered more than once. A
     * redelivered subscription.updated must not re-run the plan change or
     * re-audit it.
     */
    @Test
    void anAlreadyProcessedEventIsDropped() {
        when(processedEvents.tryClaim(anyString())).thenReturn(0);

        deliver(event("customer.subscription.updated", PRICE_PRO_MONTHLY, "active",
            tenantId.toString()));

        assertThat(tenant.plan()).isEqualTo(Plan.STARTER);
        verify(tenantRepository, never()).save(any());
    }

    @Test
    void unrelatedEventTypesAreClaimedAndIgnored() {
        String payload = StripeEventFixture.subscriptionEvent(
            "evt_x", "invoice.payment_succeeded", "sub_123", "cus_123",
            tenantId.toString(), PRICE_PRO_MONTHLY, "active", PERIOD_END);

        deliver(payload);

        verify(tenantRepository, never()).save(any());
    }

    // ── resolving the tenant ────────────────────────────────────────────

    /**
     * A subscription created by hand in the Stripe dashboard carries no
     * metadata. Refusing to recognise it would leave someone who is genuinely
     * paying stuck behind the read-only lock.
     */
    @Test
    void aSubscriptionWithoutMetadataIsResolvedByItsCustomerId() {
        when(tenantRepository.findByStripeCustomerId("cus_123")).thenReturn(Optional.of(tenant));

        deliver(event("customer.subscription.updated", PRICE_PRO_MONTHLY, "active", null));

        assertThat(tenant.plan()).isEqualTo(Plan.PRO);
    }

    @Test
    void aSubscriptionBelongingToNoTenantIsIgnoredRatherThanRetried() {
        when(tenantRepository.findById(any())).thenReturn(Optional.empty());

        deliver(event("customer.subscription.updated", PRICE_PRO_MONTHLY, "active",
            UUID.randomUUID().toString()));

        verify(tenantRepository, never()).save(any());
    }

    // ── configuration drift ─────────────────────────────────────────────

    /**
     * Someone switches the customer to a price we do not know about — a plan
     * created in the Stripe dashboard, say. Guessing a tier would be worse than
     * leaving them where they are: the status still updates, so they keep
     * working, and the mismatch is logged as an error instead of silently
     * downgrading or upgrading a paying customer.
     */
    @Test
    void anUnmappedPriceLeavesThePlanAloneButStillRecordsTheSubscription() {
        tenant.setPlan(Plan.PRO);

        deliver(event("customer.subscription.updated", "price_something_else", "active",
            tenantId.toString()));

        assertThat(tenant.plan()).isEqualTo(Plan.PRO);
        assertThat(tenant.getSubscriptionStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
        verify(tenantRepository).save(tenant);
    }

    @Test
    void aSubscriptionWithNoLineItemsDoesNotCrashOrChangeThePlan() {
        tenant.setPlan(Plan.PRO);

        deliver(event("customer.subscription.updated", null, "active", tenantId.toString()));

        assertThat(tenant.plan()).isEqualTo(Plan.PRO);
        assertThat(tenant.getCurrentPeriodEnd()).isNull();
    }
}
