package com.photographplatform.api.payment.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.UpstreamServiceException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.payment.config.PaymentProperties;
import com.photographplatform.api.payment.dto.StripeConnectStatusResponse;
import com.photographplatform.api.payment.dto.StripeOnboardingLinkResponse;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
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
 * Onboarding and capability tracking for the photographer's own Stripe
 * account (Connect, Express).
 *
 * <p>The photographer — not the platform — is the merchant of record. Their
 * invoice names them as the issuer under §14 UStG, so the money has to land
 * in their account for the document to be true; the platform's commission is
 * taken out of the same charge as an {@code application_fee_amount}. That is
 * why charges are created <em>on</em> this connected account (direct charges)
 * rather than on the platform's with a transfer afterwards: a destination
 * charge would route the client's money through us first, which is both a
 * different legal posture and a different set of licensing obligations.
 *
 * <p>Stripe's hosted onboarding does the KYC. We only ever hold an account
 * id and a mirror of three capability flags — never bank details, never
 * identity documents.
 */
@Service
public class StripeConnectService {

    private static final Logger LOG = LoggerFactory.getLogger(StripeConnectService.class);

    private final Optional<StripeClient> stripeClient;
    private final TenantRepository tenantRepository;
    private final PaymentProperties paymentProperties;
    private final AuditService auditService;
    private final String webBaseUrl;
    private final TransactionTemplate transactionTemplate;

    public StripeConnectService(
        Optional<StripeClient> stripeClient,
        TenantRepository tenantRepository,
        PaymentProperties paymentProperties,
        AuditService auditService,
        @Value("${app.web.base-url:http://localhost:3000}") String webBaseUrl,
        PlatformTransactionManager transactionManager
    ) {
        this.stripeClient = stripeClient;
        this.tenantRepository = tenantRepository;
        this.paymentProperties = paymentProperties;
        this.auditService = auditService;
        this.webBaseUrl = webBaseUrl;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Transactional(readOnly = true)
    public StripeConnectStatusResponse getStatus() {
        return toStatus(tenantRepository.require(SecurityUtils.requireCurrentTenantId()));
    }

    /**
     * A fresh link into Stripe's hosted Express onboarding, creating the
     * connected account first if this tenant has never started.
     *
     * <p>Deliberately not one big {@code @Transactional} method. Creating the
     * account is a remote side effect that cannot be rolled back: if the
     * account-link call afterwards failed inside the same transaction, the
     * saved {@code stripe_account_id} would roll back with it and the next
     * attempt would create a <em>second</em> account at Stripe, orphaning the
     * first. Committing the id in its own short transaction first means a
     * retry always finds the account it already made.
     */
    public StripeOnboardingLinkResponse createOnboardingLink(String ipAddress) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();
        String accountId = transactionTemplate.execute(status -> ensureAccount(tenantId, actorId, ipAddress));

        try {
            AccountLink link = requireStripe().accountLinks().create(
                AccountLinkCreateParams.builder()
                    .setAccount(accountId)
                    .setType(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING)
                    // Stripe expires these in minutes and sends the browser to
                    // refreshUrl when that happens; the settings page answers
                    // it by asking for another link, so an expired link is a
                    // redirect rather than a dead end.
                    // Points at the Payments panel, which is where the Connect
                    // card lives since Settings was split into routes. The old
                    // /settings URL forwards here as well, so a link minted
                    // before the split still lands on the right panel.
                    .setRefreshUrl(webBaseUrl + "/settings/payments?stripe=refresh")
                    .setReturnUrl(webBaseUrl + "/settings/payments?stripe=return")
                    .build());
            return new StripeOnboardingLinkResponse(link.getUrl());
        } catch (StripeException ex) {
            LOG.error("Could not create a Stripe onboarding link for tenant {}", tenantId, ex);
            throw new UpstreamServiceException("stripe",
                "Stripe couldn't open the onboarding form just now. Please try again in a moment.", ex);
        }
    }

    /**
     * Pulls the connected account's current capabilities from Stripe and
     * stores them. Called when the photographer returns from onboarding —
     * the {@code account.updated} webhook is the authoritative channel, but
     * it can arrive after the redirect, and a settings page that still says
     * "not connected" right after a successful onboarding reads as a failure.
     */
    public StripeConnectStatusResponse refreshStatus(String ipAddress) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();

        String accountId = transactionTemplate.execute(
            status -> tenantRepository.require(tenantId).getStripeAccountId());
        if (accountId == null) {
            return transactionTemplate.execute(status -> toStatus(tenantRepository.require(tenantId)));
        }

        // Outside any transaction, for the reason createOnboardingLink above
        // spells out and this method used to ignore: a @Transactional around
        // this call held a pooled connection for the entire Stripe round-trip.
        // The pool is ten deep and shared with every other request in the
        // product, so a slow Stripe turned "the settings page is sluggish" into
        // "the whole API is down".
        Account account;
        try {
            account = requireStripe().accounts().retrieve(accountId);
        } catch (StripeException ex) {
            LOG.error("Could not refresh Stripe account {} for tenant {}", accountId, tenantId, ex);
            throw new UpstreamServiceException("stripe",
                "Stripe didn't answer just now, so this page may be showing stale details. "
                    + "Please try again in a moment.", ex);
        }

        // Re-read rather than reusing the instance from the first transaction:
        // that one is detached, and the webhook may have updated the row while
        // we were waiting on Stripe.
        return transactionTemplate.execute(status -> {
            Tenant tenant = tenantRepository.require(tenantId);
            boolean wasEnabled = tenant.isStripeChargesEnabled();
            applyCapabilities(tenant, account);
            tenantRepository.save(tenant);
            if (!wasEnabled && tenant.isStripeChargesEnabled()) {
                auditService.log("STRIPE_CONNECT_ENABLED", "TENANT", tenantId, tenantId,
                    actorId, ipAddress);
            }
            return toStatus(tenant);
        });
    }

    /**
     * Webhook path for {@code account.updated}. Runs with no tenant bound —
     * the event carries only an {@code acct_…} — which is safe because {@code
     * tenants} is outside RLS (V11). An account we don't recognise is logged
     * and ignored rather than treated as an error: the platform's own account
     * emits this event too, and so would any connected account created
     * outside this app.
     */
    public void applyAccountUpdate(Account account) {
        if (account == null || account.getId() == null) {
            return;
        }
        Optional<Tenant> maybeTenant = tenantRepository.findByStripeAccountId(account.getId());
        if (maybeTenant.isEmpty()) {
            LOG.debug("account.updated for unknown connected account {} — ignoring", account.getId());
            return;
        }
        Tenant tenant = maybeTenant.get();
        boolean wasEnabled = tenant.isStripeChargesEnabled();
        applyCapabilities(tenant, account);
        tenantRepository.save(tenant);
        if (wasEnabled != tenant.isStripeChargesEnabled()) {
            auditService.log(
                tenant.isStripeChargesEnabled() ? "STRIPE_CONNECT_ENABLED" : "STRIPE_CONNECT_DISABLED",
                "TENANT", tenant.getId(), tenant.getId(), null, "stripe-webhook");
        }
    }

    /** The commission, in basis points, that applies to this tenant's plan. */
    public int commissionBpsFor(Tenant tenant) {
        return paymentProperties.getCommission().bpsForPlan(tenant.getPlan());
    }

    private String ensureAccount(UUID tenantId, UUID actorId, String ipAddress) {
        Tenant tenant = tenantRepository.require(tenantId);
        if (tenant.getStripeAccountId() != null && !tenant.getStripeAccountId().isBlank()) {
            return tenant.getStripeAccountId();
        }
        Account account;
        try {
            account = requireStripe().accounts().create(
                AccountCreateParams.builder()
                    .setType(AccountCreateParams.Type.EXPRESS)
                    .setCountry(tenant.getCountry() != null ? tenant.getCountry() : "DE")
                    .setEmail(tenant.getOwnerEmail())
                    .setCapabilities(
                        AccountCreateParams.Capabilities.builder()
                            .setCardPayments(
                                AccountCreateParams.Capabilities.CardPayments.builder()
                                    .setRequested(true).build())
                            // Requested even though direct charges settle in
                            // the connected account without a transfer: Stripe
                            // requires `transfers` for an Express account to be
                            // paid out at all, and it is what makes the
                            // application fee legal on the charge.
                            .setTransfers(
                                AccountCreateParams.Capabilities.Transfers.builder()
                                    .setRequested(true).build())
                            .setSepaDebitPayments(
                                AccountCreateParams.Capabilities.SepaDebitPayments.builder()
                                    .setRequested(true).build())
                            .build())
                    .putMetadata("tenant_id", tenantId.toString())
                    .putMetadata("subdomain", tenant.getSubdomain())
                    .build());
        } catch (StripeException ex) {
            LOG.error("Could not create a Stripe connected account for tenant {}", tenantId, ex);
            throw new UpstreamServiceException("stripe",
                "Stripe couldn't create your payout account just now. Please try again in a moment.", ex);
        }
        tenant.setStripeAccountId(account.getId());
        applyCapabilities(tenant, account);
        tenantRepository.save(tenant);
        auditService.log("STRIPE_CONNECT_ACCOUNT_CREATED", "TENANT", tenantId, tenantId, actorId, ipAddress);
        return account.getId();
    }

    private void applyCapabilities(Tenant tenant, Account account) {
        tenant.applyStripeCapabilities(
            Boolean.TRUE.equals(account.getChargesEnabled()),
            Boolean.TRUE.equals(account.getPayoutsEnabled()),
            Boolean.TRUE.equals(account.getDetailsSubmitted()));
    }

    private StripeConnectStatusResponse toStatus(Tenant tenant) {
        return new StripeConnectStatusResponse(
            stripeClient.isPresent(),
            tenant.getStripeAccountId(),
            tenant.isStripeChargesEnabled(),
            tenant.isStripePayoutsEnabled(),
            tenant.isStripeDetailsSubmitted(),
            tenant.getStripeOnboardedAt(),
            tenant.getPlan(),
            commissionBpsFor(tenant)
        );
    }

    private StripeClient requireStripe() {
        return stripeClient.orElseThrow(() -> new ConflictException(
            "Online payments are not available on this deployment — Stripe is not configured"));
    }
}
