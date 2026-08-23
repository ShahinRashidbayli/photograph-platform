package com.photographplatform.api.payment.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.payment.config.PaymentProperties;
import com.photographplatform.api.payment.domain.Payment;
import com.photographplatform.api.payment.domain.PaymentStatus;
import com.photographplatform.api.payment.repository.PaymentRepository;
import com.photographplatform.api.payment.repository.ProcessedStripeEventRepository;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Account;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.model.StripeObject;
import com.stripe.net.Webhook;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Inbound Stripe webhooks: signature verification, idempotency, and applying
 * an event to the row it belongs to.
 *
 * <p>Split out of {@code PaymentService} because it is the one flow in the
 * payment domain that runs with no authenticated caller. Everything else there
 * starts from a JWT and a bound tenant; this starts from a signature and has to
 * <em>derive</em> the tenant from the event before it can touch a row. That
 * inversion is the reason for the unusual transaction handling below, and
 * keeping it beside the request-path code made both harder to read.
 *
 * <h2>Why the transaction is started by hand</h2>
 * Deliberately not {@code @Transactional} at the method level. A transaction's
 * JDBC connection — and with it the {@code app.tenant_id} GUC that {@code
 * TenantRoutingDataSource} binds when the connection is acquired — is fixed for
 * the whole transaction. If a {@code @Transactional} proxy had already opened
 * the transaction before {@link TenantContext} is set, setting it afterwards
 * would silently do nothing: RLS would fail closed and the payment lookup would
 * find zero rows even though the row exists. Starting a genuinely new
 * transaction only once the tenant is known is what guarantees the GUC is bound
 * at the right moment. Signature verification and deserialization need no DB
 * access at all, so they happen first.
 */
@Service
public class StripeWebhookService {

    private static final Logger LOG = LoggerFactory.getLogger(StripeWebhookService.class);

    /**
     * The only {@code payment_intent.*} events that move a payment row. Kept
     * as a set rather than left to the switch's {@code default} so {@link
     * #apply} can tell "we don't act on this" apart from "we couldn't act on
     * this" <em>before</em> it goes looking for the row — the two need opposite
     * answers about whether the idempotency claim should survive.
     */
    private static final Set<String> SETTLEMENT_EVENTS = Set.of(
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
        "payment_intent.canceled");

    private final PaymentRepository paymentRepository;
    private final ProcessedStripeEventRepository processedEventRepository;
    private final StripeConnectService connectService;
    private final AuditService auditService;
    private final String webhookSecret;
    private final Clock clock;
    private final TransactionTemplate freshTransaction;

    public StripeWebhookService(
        PaymentRepository paymentRepository,
        ProcessedStripeEventRepository processedEventRepository,
        StripeConnectService connectService,
        AuditService auditService,
        PaymentProperties paymentProperties,
        PlatformTransactionManager transactionManager,
        Clock clock
    ) {
        this.paymentRepository = paymentRepository;
        this.processedEventRepository = processedEventRepository;
        this.connectService = connectService;
        this.auditService = auditService;
        this.webhookSecret = paymentProperties.getWebhookSecret();
        this.clock = clock;
        this.freshTransaction = new TransactionTemplate(transactionManager);
    }

    /** Verifies the Stripe signature, then applies the event idempotently. */
    public void handle(String payload, String signatureHeader) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new IllegalStateException("Stripe webhook secret not configured");
        }
        Event event;
        try {
            event = Webhook.constructEvent(payload, signatureHeader, webhookSecret);
        } catch (SignatureVerificationException ex) {
            throw new ConflictException("Invalid Stripe webhook signature");
        }

        // Direct charges live on the connected account, so Stripe stamps the
        // event with it. Everything below that touches a payment row checks
        // this against the row's own account.
        String connectedAccountId = event.getAccount();

        PaymentIntent intent = isPaymentIntentEvent(event.getType())
            ? deserializeEventObject(event, PaymentIntent.class)
            : null;
        String tenantIdStr = (intent != null && intent.getMetadata() != null)
            ? intent.getMetadata().get("tenant_id")
            : null;

        if (tenantIdStr != null) {
            TenantContext.setTenant(tenantIdStr);
        }
        try {
            freshTransaction.executeWithoutResult(
                status -> apply(event, intent, tenantIdStr, connectedAccountId));
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * Applies one event, having first claimed it.
     *
     * <h2>What the claim means, and when it must be given back</h2>
     * {@link ProcessedStripeEventRepository#tryClaim} is the idempotency
     * ledger: once an event id is in it, every redelivery of that event is
     * dropped. That makes the claim a one-way door, and the two reasons this
     * method can stop early are not the same kind of reason:
     *
     * <ul>
     *   <li><b>Deliberately ignored</b> — an event type we don't act on, an
     *       intent that isn't ours, an event for the wrong connected account.
     *       Redelivering it would produce the same decision, so keeping the
     *       claim is right.</li>
     *   <li><b>Could not be processed</b> — the payload wouldn't deserialize,
     *       or the row it belongs to isn't visible yet. A retry genuinely
     *       might succeed, and keeping the claim would make sure it never
     *       does: the payment stays PENDING forever with nothing but a WARN
     *       to say so, while the money has actually moved.</li>
     * </ul>
     *
     * <p>The second kind therefore throws. The whole method runs inside {@link
     * #freshTransaction}, so the throw rolls the claim back with it and the
     * non-2xx response asks Stripe to redeliver — which it does, with backoff,
     * and surfaces in the Stripe dashboard if it keeps failing. That is a far
     * better resting place for the problem than a log line.
     */
    private void apply(Event event, PaymentIntent intent, String tenantIdStr, String connectedAccountId) {
        boolean claimed = processedEventRepository.tryClaim(event.getId()) > 0;
        if (!claimed) {
            LOG.info("Ignoring already-processed Stripe event {}", event.getId());
            return;
        }

        if (isPaymentIntentEvent(event.getType())) {
            // Only the three terminal transitions move a payment row. Anything
            // else in the family (payment_intent.created, .processing, …) is
            // deliberately ignored — and checked here, before the row lookup,
            // so a `created` event racing its own row's commit is a no-op
            // rather than a retry.
            if (!SETTLEMENT_EVENTS.contains(event.getType())) {
                return;
            }
            if (intent == null) {
                throw new IllegalStateException(
                    "Could not read the PaymentIntent out of Stripe event " + event.getId());
            }
            applyPaymentIntentUpdate(event.getType(), intent, tenantIdStr, connectedAccountId);
            return;
        }
        // Onboarding progress and capability changes on a connected account.
        // No tenant is bound here — the event carries only an acct_… — which
        // is fine: StripeConnectService resolves the tenant from that id, and
        // `tenants` sits outside RLS (V11).
        if ("account.updated".equals(event.getType())) {
            Account account = deserializeEventObject(event, Account.class);
            if (account == null) {
                throw new IllegalStateException(
                    "Could not read the Account out of Stripe event " + event.getId());
            }
            connectService.applyAccountUpdate(account);
        }
    }

    /**
     * {@code getObject()} only succeeds when the event's {@code api_version}
     * matches the SDK's compiled version exactly — Stripe's documented
     * fallback is {@code deserializeUnsafe()}, which parses the raw JSON
     * regardless of version skew. Without this fallback, a Stripe account
     * pinned to a slightly different API version than this SDK build would
     * silently produce a {@code null} object here and every webhook would be
     * marked processed without ever updating the payment row.
     */
    private <T extends StripeObject> T deserializeEventObject(Event event, Class<T> type) {
        Optional<StripeObject> deserialized = event.getDataObjectDeserializer().getObject();
        StripeObject object;
        if (deserialized.isPresent()) {
            object = deserialized.get();
        } else {
            try {
                object = event.getDataObjectDeserializer().deserializeUnsafe();
            } catch (com.stripe.exception.EventDataObjectDeserializationException ex) {
                LOG.warn("Could not deserialize Stripe event {} data object", event.getId(), ex);
                return null;
            }
        }
        return type.isInstance(object) ? type.cast(object) : null;
    }

    /**
     * {@link #handle} has already bound {@link TenantContext} before the first
     * DB call — this must not re-set it, since by now the transaction's
     * connection (and its {@code app.tenant_id} GUC) is fixed for the rest of
     * the transaction regardless.
     */
    private void applyPaymentIntentUpdate(
        String eventType, PaymentIntent intent, String tenantIdStr, String connectedAccountId) {
        // No tenant_id metadata means this intent was not created by us — a
        // charge made straight from the photographer's Stripe dashboard, say.
        // Nothing here to update, and a retry would say the same, so the claim
        // stands.
        if (tenantIdStr == null) {
            LOG.warn("PaymentIntent {} has no tenant_id metadata — skipping", intent.getId());
            return;
        }
        // A settlement event for an intent we created but cannot find is not a
        // "nothing to do": the metadata says it is ours, so the row exists and
        // we simply can't see it yet. Throwing hands the event back to Stripe's
        // retry schedule instead of stranding a paid invoice as unpaid.
        Payment payment = paymentRepository.findByStripePaymentIntentId(intent.getId())
            .orElseThrow(() -> new IllegalStateException(
                "No payment row for PaymentIntent " + intent.getId() + " — retrying"));
        // The signature proves the event came from Stripe, not that it came
        // from *this* payment's merchant. An intent id is guessable in
        // principle, and a webhook endpoint shared across connected accounts
        // receives all of theirs, so refuse to settle a row whose account
        // doesn't match the one Stripe stamped on the event.
        //
        // Checked unconditionally. It used to be skipped when the row carried
        // no account id, which every row does today — so the guard was a
        // guard with an exemption nobody could name a reason for, and a single
        // future code path writing a null would have silently reopened it.
        if (!Objects.equals(payment.getStripeAccountId(), connectedAccountId)) {
            LOG.warn("PaymentIntent {} arrived for account {} but payment {} belongs to {} — skipping",
                intent.getId(), connectedAccountId, payment.getId(), payment.getStripeAccountId());
            return;
        }
        // Exhaustive over SETTLEMENT_EVENTS, which `apply` has already filtered
        // on — anything else never reaches this method.
        switch (eventType) {
            case "payment_intent.succeeded" -> {
                reconcileAmount(payment, intent);
                payment.setStatus(PaymentStatus.SUCCEEDED);
                payment.setConfirmedAt(OffsetDateTime.now(clock));
            }
            case "payment_intent.payment_failed" -> payment.setStatus(PaymentStatus.FAILED);
            case "payment_intent.canceled" -> payment.setStatus(PaymentStatus.CANCELED);
            default -> throw new IllegalStateException("Unhandled settlement event " + eventType);
        }
        paymentRepository.save(payment);
        auditService.log("PAYMENT_" + payment.getStatus(), "PAYMENT", payment.getId(),
            UUID.fromString(tenantIdStr), payment.getConfirmedByUserId(), "stripe-webhook");
    }

    /**
     * Records what Stripe says actually arrived, not what we asked for.
     *
     * <p>The row's {@code amount_cents} is our <em>request</em> — the balance
     * outstanding when the intent was created. Settling it as SUCCEEDED without
     * looking at {@code amount_received} treats the two as the same number, and
     * {@code PaymentService.outstandingCents} then sums the requested amounts
     * to decide an invoice is paid. Any gap between them books money that never
     * landed: the invoice reads settled, the DATEV export claims the revenue,
     * and the only place the truth exists is the Stripe dashboard.
     *
     * <p>They do diverge in practice — a partial capture, an amount edited in
     * the dashboard, a currency-conversion difference on a connected account.
     * None are common; all are silent, which is what makes them worth a branch.
     *
     * <p>The received amount wins, and the discrepancy is logged loudly enough
     * to be found later. Refusing the event instead would be worse: the money
     * has moved either way, and a payment stuck PENDING forever is not a safer
     * answer than one recorded at the amount that actually arrived.
     */
    private void reconcileAmount(Payment payment, PaymentIntent intent) {
        Long received = intent.getAmountReceived();
        if (received == null || received.intValue() == payment.getAmountCents()) {
            return;
        }
        LOG.warn("PaymentIntent {} settled {} cents but payment {} was created for {} — "
                + "recording the amount Stripe reports as received",
            intent.getId(), received, payment.getId(), payment.getAmountCents());
        payment.correctAmountToReceived(received.intValue());
    }

    private boolean isPaymentIntentEvent(String type) {
        return type.startsWith("payment_intent.");
    }
}
