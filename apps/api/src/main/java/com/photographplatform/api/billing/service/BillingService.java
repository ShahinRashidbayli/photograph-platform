package com.photographplatform.api.billing.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.billing.config.BillingProperties;
import com.photographplatform.api.billing.domain.BillingInterval;
import com.photographplatform.api.billing.dto.BillingStatusResponse;
import com.photographplatform.api.billing.dto.CheckoutSessionResponse;
import com.photographplatform.api.billing.dto.StartCheckoutRequest;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UpstreamServiceException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.entitlement.domain.TenantAccess;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.billingportal.Session;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.billingportal.SessionCreateParams;
import com.stripe.param.checkout.SessionCreateParams.LineItem;
import com.stripe.param.checkout.SessionCreateParams.Mode;
import com.stripe.param.checkout.SessionCreateParams.SubscriptionData;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Selling the subscription — the half of PRICING.md §6.6 that takes money.
 *
 * <p>Everything a photographer does here has to work while their account is in
 * the read-only lock, because the lock is exactly what they are trying to
 * escape. See {@code AllowedWhenReadOnly} on the controller: without that
 * exemption, paying is a POST, POSTs are locked, and the account can never be
 * unlocked by the person we are trying to collect from.
 *
 * <p>The tenant's plan is never written here. It is written by
 * {@link BillingWebhookService} from the price on the subscription Stripe
 * confirms — a checkout that is started but abandoned must not upgrade anyone.
 */
@Service
public class BillingService {

    private static final Logger LOG = LoggerFactory.getLogger(BillingService.class);

    /**
     * Stripe rejects a {@code trial_end} that is not at least 48 hours out.
     * Below that we simply omit it and the subscription starts billing
     * immediately — losing someone the last few hours of a free trial they
     * chose to end early by subscribing is the right way round.
     */
    private static final Duration MIN_STRIPE_TRIAL = Duration.ofHours(48);

    private final Optional<StripeClient> stripeClient;
    private final TenantRepository tenantRepository;
    private final EntitlementService entitlementService;
    private final BillingProperties properties;
    private final AuditService auditService;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    @Value("${app.web.base-url:http://localhost:3000}")
    private String webBaseUrl;

    public BillingService(
        Optional<StripeClient> stripeClient,
        TenantRepository tenantRepository,
        EntitlementService entitlementService,
        BillingProperties properties,
        AuditService auditService,
        PlatformTransactionManager transactionManager,
        Clock clock) {
        this.stripeClient = stripeClient;
        this.tenantRepository = tenantRepository;
        this.entitlementService = entitlementService;
        this.properties = properties;
        this.auditService = auditService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public BillingStatusResponse getStatus() {
        Tenant tenant = requireTenant(SecurityUtils.requireCurrentTenantId());
        TenantAccess access = entitlementService.accessFor(tenant);
        return new BillingStatusResponse(
            tenant.plan().name(),
            tenant.getSubscriptionStatus().name(),
            tenant.getTrialEndsAt(),
            tenant.getCurrentPeriodEnd(),
            properties.isConfigured() && stripeClient.isPresent(),
            tenant.getStripeCustomerId() != null,
            access.writable(),
            access.lockReason());
    }

    /**
     * Opens a Stripe Checkout session for a subscription.
     *
     * <p>The customer id is committed in its own short transaction before the
     * session call, for the same reason {@code StripeConnectService} does it
     * for connected accounts: if the session call failed inside one
     * transaction, the saved {@code stripe_customer_id} would roll back with
     * it and the next attempt would create a <em>second</em> customer at
     * Stripe, orphaning the first and splitting one photographer's billing
     * history across two records.
     */
    public CheckoutSessionResponse startCheckout(StartCheckoutRequest request, String ipAddress) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();

        Plan plan = Plan.from(request.plan());
        BillingInterval interval = BillingInterval.from(request.interval());
        String priceId = properties.priceFor(plan, interval).orElseThrow(() -> new ConflictException(
            "Subscriptions are not available on this deployment — no Stripe price is configured for "
                + plan + " " + interval + "."));

        String customerId = transactionTemplate.execute(
            status -> ensureCustomer(tenantId, actorId, ipAddress));

        try {
            com.stripe.model.checkout.Session session = requireStripe().checkout().sessions().create(
                buildCheckoutParams(tenantId, customerId, priceId, plan, interval));
            return new CheckoutSessionResponse(session.getUrl());
        } catch (StripeException ex) {
            LOG.error("Could not open a Stripe checkout session for tenant {}", tenantId, ex);
            throw new UpstreamServiceException("stripe",
                "Stripe couldn't open the checkout just now. Please try again in a moment.", ex);
        }
    }

    private com.stripe.param.checkout.SessionCreateParams buildCheckoutParams(
        UUID tenantId, String customerId, String priceId, Plan plan, BillingInterval interval) {

        SubscriptionData.Builder subscriptionData = SubscriptionData.builder()
            // Stamped on the subscription itself, not just the session: the
            // webhook that decides a tenant's tier reads customer.subscription.*
            // events, which carry the subscription's metadata and know nothing
            // about the checkout session that produced them.
            .putMetadata("tenant_id", tenantId.toString());

        // Someone who subscribes mid-trial keeps the days they were promised
        // rather than paying twice for the same fortnight.
        Tenant tenant = requireTenant(tenantId);
        OffsetDateTime trialEndsAt = tenant.getTrialEndsAt();
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (trialEndsAt != null && trialEndsAt.isAfter(now.plus(MIN_STRIPE_TRIAL))) {
            subscriptionData.setTrialEnd(trialEndsAt.toEpochSecond());
        }

        return com.stripe.param.checkout.SessionCreateParams.builder()
            .setMode(Mode.SUBSCRIPTION)
            .setCustomer(customerId)
            .addLineItem(LineItem.builder().setPrice(priceId).setQuantity(1L).build())
            .setSubscriptionData(subscriptionData.build())
            .putMetadata("tenant_id", tenantId.toString())
            .putMetadata("plan", plan.name())
            .putMetadata("interval", interval.name())
            // Stripe replaces the placeholder; the settings page uses it to
            // poll until the webhook has landed, so a photographer who returns
            // faster than the webhook does not see "still in trial".
            .setSuccessUrl(webBaseUrl + "/settings?billing=success&session={CHECKOUT_SESSION_ID}")
            .setCancelUrl(webBaseUrl + "/settings?billing=cancelled")
            .build();
    }

    /**
     * Opens Stripe's hosted billing portal — card changes, invoices,
     * cancellation and plan switches all live there.
     *
     * <p>Deliberately not rebuilt in our own UI. It is regulated surface
     * (SCA re-authentication, invoice history, dunning) that Stripe keeps
     * current for free, and every screen we did not build is a screen that
     * cannot disagree with what Stripe actually charged.
     */
    @Transactional(readOnly = true)
    public CheckoutSessionResponse openPortal() {
        Tenant tenant = requireTenant(SecurityUtils.requireCurrentTenantId());
        if (tenant.getStripeCustomerId() == null) {
            throw new ConflictException(
                "There is no subscription to manage yet. Choose a plan first.");
        }
        try {
            Session session = requireStripe().billingPortal().sessions().create(
                SessionCreateParams.builder()
                    .setCustomer(tenant.getStripeCustomerId())
                    .setReturnUrl(webBaseUrl + "/settings?billing=portal")
                    .build());
            return new CheckoutSessionResponse(session.getUrl());
        } catch (StripeException ex) {
            LOG.error("Could not open the Stripe billing portal for tenant {}", tenant.getId(), ex);
            throw new UpstreamServiceException("stripe",
                "Stripe couldn't open the billing portal just now. Please try again in a moment.", ex);
        }
    }

    /**
     * Returns this tenant's Stripe customer id, creating it on first use.
     *
     * <p>Idempotent by the stored id: a second checkout reuses the customer, so
     * one photographer keeps one billing history.
     */
    private String ensureCustomer(UUID tenantId, UUID actorId, String ipAddress) {
        Tenant tenant = requireTenant(tenantId);
        if (tenant.getStripeCustomerId() != null && !tenant.getStripeCustomerId().isBlank()) {
            return tenant.getStripeCustomerId();
        }
        try {
            Customer customer = requireStripe().customers().create(
                CustomerCreateParams.builder()
                    .setEmail(tenant.getOwnerEmail())
                    .setName(tenant.getBusinessName() != null && !tenant.getBusinessName().isBlank()
                        ? tenant.getBusinessName()
                        : tenant.getSubdomain())
                    .putAllMetadata(Map.of(
                        "tenant_id", tenantId.toString(),
                        "subdomain", tenant.getSubdomain()))
                    .build());
            tenant.setStripeCustomerId(customer.getId());
            tenantRepository.save(tenant);
            auditService.log("BILLING_CUSTOMER_CREATED", "TENANT", tenantId, tenantId, actorId, ipAddress);
            return customer.getId();
        } catch (StripeException ex) {
            LOG.error("Could not create a Stripe customer for tenant {}", tenantId, ex);
            throw new UpstreamServiceException("stripe",
                "Stripe couldn't start the checkout just now. Please try again in a moment.", ex);
        }
    }

    private Tenant requireTenant(UUID tenantId) {
        return tenantRepository.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Tenant not found"));
    }

    private StripeClient requireStripe() {
        return stripeClient.orElseThrow(() -> new ConflictException(
            "Subscriptions are not available on this deployment — Stripe is not configured"));
    }
}
