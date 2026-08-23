package com.photographplatform.api.billing.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.billing.config.BillingProperties;
import com.photographplatform.api.common.cache.GateCache;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.payment.repository.ProcessedStripeEventRepository;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.SubscriptionStatus;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.stripe.exception.EventDataObjectDeserializationException;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.StripeObject;
import com.stripe.model.Subscription;
import com.stripe.model.SubscriptionItem;
import com.stripe.net.Webhook;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Subscription lifecycle from Stripe — the only thing that may change a
 * tenant's plan.
 *
 * <p>Deliberately separate from {@code StripeWebhookService}, which handles
 * charges on <em>connected</em> accounts. These events are on the platform
 * account, arrive at their own endpoint with their own signing secret, and
 * need no tenant bound before the first query: {@code tenants} is one of the
 * tables V11 left outside RLS. Folding them together would have meant one
 * secret for two unrelated traffic streams and a tenant-binding dance this
 * flow does not need.
 *
 * <p>The plan is written here and nowhere else. {@code RegisterRequest} carries
 * a plan name, but that only chooses which tier the free trial runs on — as its
 * own javadoc put it, the plan "must come from a paid subscription, never from
 * this field".
 */
@Service
public class BillingWebhookService {

    private static final Logger LOG = LoggerFactory.getLogger(BillingWebhookService.class);

    /**
     * The events that move a tenant's subscription state. Everything else is
     * claimed and ignored — {@code invoice.*}, {@code payment_method.*} and
     * friends all end up reflected in the subscription's own status, so acting
     * on them separately would be two sources of truth for one fact.
     */
    private static final Set<String> SUBSCRIPTION_EVENTS = Set.of(
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted");

    private final TenantRepository tenantRepository;
    private final ProcessedStripeEventRepository processedEventRepository;
    private final BillingProperties properties;
    private final AuditService auditService;
    private final GateCache gateCache;

    public BillingWebhookService(
        TenantRepository tenantRepository,
        ProcessedStripeEventRepository processedEventRepository,
        BillingProperties properties,
        AuditService auditService,
        GateCache gateCache) {
        this.tenantRepository = tenantRepository;
        this.processedEventRepository = processedEventRepository;
        this.properties = properties;
        this.auditService = auditService;
        this.gateCache = gateCache;
    }

    /**
     * Verifies the signature, then applies the event once.
     *
     * <p>Unlike the Connect webhook this can be plainly {@code @Transactional}:
     * every row it touches is in {@code tenants}, which sits outside RLS, so
     * there is no tenant to bind before the connection is acquired.
     */
    @Transactional
    public void handle(String payload, String signatureHeader) {
        String secret = properties.getWebhookSecret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("Stripe billing webhook secret not configured");
        }
        Event event;
        try {
            event = Webhook.constructEvent(payload, signatureHeader, secret);
        } catch (SignatureVerificationException ex) {
            throw new ConflictException("Invalid Stripe webhook signature");
        }

        // Claimed before anything is applied: Stripe documents that the same
        // event can be delivered more than once, and a redelivered
        // subscription.updated would re-run the plan change and re-audit it.
        if (processedEventRepository.tryClaim(event.getId()) == 0) {
            LOG.info("Ignoring already-processed Stripe billing event {}", event.getId());
            return;
        }
        if (!SUBSCRIPTION_EVENTS.contains(event.getType())) {
            return;
        }

        Subscription subscription = deserialize(event, Subscription.class);
        if (subscription == null) {
            // A retry might deserialize; keeping the claim would guarantee it
            // never does, stranding a paying customer in the read-only lock.
            // Throwing rolls the claim back with the transaction and hands the
            // event to Stripe's retry schedule, where a persistent failure is
            // visible in the dashboard rather than buried in a log line.
            throw new IllegalStateException(
                "Could not read the Subscription out of Stripe event " + event.getId());
        }
        applySubscription(event.getType(), subscription);
    }

    private void applySubscription(String eventType, Subscription subscription) {
        Optional<Tenant> resolved = resolveTenant(subscription);
        if (resolved.isEmpty()) {
            // Not ours. A subscription on the platform account that belongs to
            // no tenant is a manual experiment or another product sharing the
            // Stripe account — a retry would decide the same, so the claim
            // stands.
            LOG.warn("Stripe subscription {} matches no tenant — ignoring", subscription.getId());
            return;
        }
        Tenant tenant = resolved.get();

        SubscriptionStatus status = "customer.subscription.deleted".equals(eventType)
            // Stripe sends the subscription's last status on the delete event,
            // which can still read "active". The event itself is the fact:
            // the subscription is gone.
            ? SubscriptionStatus.CANCELED
            : SubscriptionStatus.fromStripe(subscription.getStatus());

        Plan previousPlan = tenant.plan();
        priceIdOf(subscription).ifPresentOrElse(
            priceId -> properties.planForPrice(priceId).ifPresentOrElse(
                tenant::setPlan,
                () -> LOG.error(
                    "Stripe subscription {} (tenant {}) is on price {}, which maps to no plan. "
                        + "Leaving the tenant on {} — check app.billing.prices against the prices "
                        + "configured in Stripe.",
                    subscription.getId(), tenant.getId(), priceId, previousPlan)),
            () -> LOG.warn("Stripe subscription {} has no line items; plan left unchanged",
                subscription.getId()));

        tenant.applySubscription(subscription.getId(), status, currentPeriodEnd(subscription));
        tenantRepository.save(tenant);
        // This event is the one thing that closes the write gate on a schedule
        // nobody chose — a card fails, and the account should stop growing now
        // rather than when WriteAccessInterceptor's cached pass happens to
        // lapse. Deferred to after commit so the re-read cannot see the old row.
        gateCache.forgetAfterCommit(GateCache.WRITABLE, tenant.getId());

        auditService.log("SUBSCRIPTION_" + status, "TENANT", tenant.getId(), tenant.getId(),
            null, "stripe-webhook");
        LOG.info("Tenant {} subscription is now {} on plan {} (was {})",
            tenant.getSubdomain(), status, tenant.plan(), previousPlan);
    }

    /**
     * The subscription's tenant, by the metadata we stamp at checkout, falling
     * back to the customer id.
     *
     * <p>The fallback matters: a subscription created by hand in the Stripe
     * dashboard — support fixing something, or an early customer set up
     * manually — carries no metadata, and refusing to recognise it would leave
     * someone who is genuinely paying stuck behind the read-only lock.
     */
    private Optional<Tenant> resolveTenant(Subscription subscription) {
        String tenantId = subscription.getMetadata() == null
            ? null
            : subscription.getMetadata().get("tenant_id");
        if (tenantId != null && !tenantId.isBlank()) {
            try {
                Optional<Tenant> byMetadata = tenantRepository.findById(UUID.fromString(tenantId));
                if (byMetadata.isPresent()) {
                    return byMetadata;
                }
            } catch (IllegalArgumentException malformed) {
                LOG.warn("Stripe subscription {} carries an unparseable tenant_id '{}'",
                    subscription.getId(), tenantId);
            }
        }
        String customerId = subscription.getCustomer();
        return customerId == null ? Optional.empty()
            : tenantRepository.findByStripeCustomerId(customerId);
    }

    private Optional<String> priceIdOf(Subscription subscription) {
        return firstItem(subscription)
            .map(SubscriptionItem::getPrice)
            .map(com.stripe.model.Price::getId);
    }

    /**
     * The end of the paid period.
     *
     * <p>Read off the subscription <em>item</em>, not the subscription: this
     * Stripe API version moved {@code current_period_end} down to the item, and
     * {@code Subscription} has no such accessor at all. Taking the first item
     * is correct for our single-price subscriptions.
     */
    private OffsetDateTime currentPeriodEnd(Subscription subscription) {
        return firstItem(subscription)
            .map(SubscriptionItem::getCurrentPeriodEnd)
            .map(epochSeconds -> OffsetDateTime.ofInstant(
                Instant.ofEpochSecond(epochSeconds), ZoneOffset.UTC))
            .orElse(null);
    }

    private Optional<SubscriptionItem> firstItem(Subscription subscription) {
        if (subscription.getItems() == null) {
            return Optional.empty();
        }
        List<SubscriptionItem> items = subscription.getItems().getData();
        return items == null || items.isEmpty() ? Optional.empty() : Optional.of(items.get(0));
    }

    /**
     * {@code getObject()} only succeeds when the event's {@code api_version}
     * matches the SDK's compiled version exactly; Stripe's documented fallback
     * is {@code deserializeUnsafe()}. Without it, an account pinned to a
     * slightly different API version would silently yield {@code null} here and
     * every subscription event would be marked processed while changing
     * nothing — see the same reasoning in {@code StripeWebhookService}.
     */
    private <T extends StripeObject> T deserialize(Event event, Class<T> type) {
        Optional<StripeObject> deserialized = event.getDataObjectDeserializer().getObject();
        StripeObject object;
        if (deserialized.isPresent()) {
            object = deserialized.get();
        } else {
            try {
                object = event.getDataObjectDeserializer().deserializeUnsafe();
            } catch (EventDataObjectDeserializationException ex) {
                LOG.warn("Could not deserialize Stripe billing event {} data object",
                    event.getId(), ex);
                return null;
            }
        }
        return type.isInstance(object) ? type.cast(object) : null;
    }
}
