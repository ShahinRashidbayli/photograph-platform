package com.photographplatform.api.payment.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.exception.UpstreamServiceException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.invoice.domain.Invoice;
import com.photographplatform.api.invoice.domain.InvoiceStatus;
import com.photographplatform.api.invoice.repository.InvoiceRepository;
import com.photographplatform.api.payment.domain.Payment;
import com.photographplatform.api.payment.domain.PaymentMethod;
import com.photographplatform.api.payment.domain.PaymentStatus;
import com.photographplatform.api.payment.config.PaymentProperties;
import com.photographplatform.api.payment.dto.CreatePaymentIntentRequest;
import com.photographplatform.api.payment.dto.InvoicePaymentSummaryResponse;
import com.photographplatform.api.payment.dto.PaymentResponse;
import com.photographplatform.api.payment.dto.RecordManualPaymentRequest;
import com.photographplatform.api.payment.repository.PaymentRepository;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Payments against an issued {@link Invoice} — Stripe Card/SEPA Payment
 * Intents, and the manual Überweisung path (still the most common method at
 * this price point in Germany, per the spec's own market read).
 *
 * <h2>Direct charges on the photographer's own Stripe account</h2>
 * Every card/SEPA charge is created <em>on the tenant's connected Express
 * account</em> (see {@link StripeConnectService}), not on the platform's. The
 * invoice this payment settles names the photographer as the issuer under §14
 * UStG, so the funds must land with the photographer for the document to be
 * true; the platform's commission comes off the same charge as an {@code
 * application_fee_amount}, which is exactly the arrangement PRICING.md §4
 * fixed on 2026-07-17 (2% on Starter, 0% on Pro/Studio).
 *
 * <p>Two consequences run through this class. A PaymentIntent created this way
 * is invisible to a platform-scoped API call, so every later {@code retrieve}
 * or {@code cancel} has to carry the same {@code stripeAccount} — which is why
 * the account id is stored on the payment row rather than looked up from the
 * tenant, whose account could in principle have been replaced. And the webhook
 * arrives with the connected account in {@link Event#getAccount()}, which is
 * checked against the row before it is allowed to settle it.
 */
@Service
public class PaymentService {

    private static final Logger LOG = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final Optional<StripeClient> stripeClient;
    private final String publishableKey;
    private final PaymentProperties.Commission commission;
    private final AuditService auditService;
    private final Clock clock;

    public PaymentService(
        PaymentRepository paymentRepository,
        InvoiceRepository invoiceRepository,
        BookingRepository bookingRepository,
        UserRepository userRepository,
        TenantRepository tenantRepository,
        Optional<StripeClient> stripeClient,
        PaymentProperties paymentProperties,
        AuditService auditService,
        Clock clock
    ) {
        this.paymentRepository = paymentRepository;
        this.invoiceRepository = invoiceRepository;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.stripeClient = stripeClient;
        this.publishableKey = paymentProperties.getPublishableKey();
        this.commission = paymentProperties.getCommission();
        this.auditService = auditService;
        this.clock = clock;
    }

    /**
     * Creates a Stripe PaymentIntent for the invoice's outstanding balance
     * and a matching {@code PENDING} payment row. The client completes it
     * with Stripe.js using the returned client secret; the row transitions
     * to SUCCEEDED/FAILED only when the webhook confirms it — never
     * optimistically here, since the client-side confirmation can still fail
     * or be abandoned after this call returns.
     */
    @Transactional
    public PaymentResponse createStripePaymentIntent(UUID invoiceId, CreatePaymentIntentRequest req, String ipAddress) {
        if (req.method() == PaymentMethod.UEBERWEISUNG) {
            throw new ConflictException("Überweisung is recorded manually, not via Stripe — use the manual endpoint");
        }
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();
        Invoice invoice = lockInvoiceForPayment(invoiceId);
        requireOwnedByCallerIfCustomer(invoice);
        requirePayable(invoice);

        // The charge goes onto the photographer's connected account, so there
        // is no fallback if they haven't finished Stripe's onboarding: taking
        // the money onto the platform account instead would put it somewhere
        // the invoice says it isn't. Fail with something the client can act on
        // — they can still pay by Überweisung, which needs no Stripe at all.
        Tenant tenant = tenantRepository.findById(tenantId)
            .orElseThrow(() -> new NotFoundException("Tenant not found"));
        if (!tenant.canAcceptStripePayments()) {
            throw new ConflictException(
                "This photographer has not finished setting up online payments yet — "
                    + "please pay by bank transfer, or ask them to connect Stripe in Settings");
        }
        String connectedAccountId = tenant.getStripeAccountId();

        long outstanding = outstandingCents(invoice);
        if (outstanding <= 0) {
            throw new ConflictException("Invoice " + invoice.getInvoiceNumber() + " is already fully paid");
        }

        // A double-click or a second browser tab must not mint a second
        // PaymentIntent for the same invoice — that's two live charges for
        // the same balance if both get confirmed. Reuse the still-open one
        // instead of creating another; it clears once the webhook resolves
        // it (SUCCEEDED/FAILED/CANCELED), so a genuinely new attempt after
        // that still gets a fresh intent.
        //
        // Only reuse it while it still bills the right amount, though: a
        // manual part-payment (or a second card payment) recorded between the
        // two calls lowers the outstanding balance, and handing back the older
        // intent would charge the client the pre-payment total — overcharging
        // them by exactly what they just paid. A stale intent is cancelled and
        // replaced rather than reused.
        Optional<Payment> existingPending = paymentRepository
            .findFirstByInvoiceIdAndStatusAndStripePaymentIntentIdIsNotNullOrderByCreatedAtDesc(
                invoice.getId(), PaymentStatus.PENDING.name());
        if (existingPending.isPresent()) {
            Payment pending = existingPending.get();
            // Reusable only while it still bills the right amount, on the
            // account we would charge today, by the method the client just
            // picked. A tenant that reconnected Stripe under a new account
            // leaves intents behind on the old one — unreachable for the
            // client, and crediting the wrong merchant if they somehow
            // weren't. And an intent is created with a fixed
            // payment_method_types: handing back the card intent to someone
            // who just chose SEPA-Lastschrift renders a card form under a
            // SEPA heading.
            boolean sameAccount = Objects.equals(connectedAccountId, pending.getStripeAccountId());
            boolean sameMethod = pending.getMethod() == req.method();
            if (pending.getAmountCents() == outstanding && sameAccount && sameMethod) {
                try {
                    PaymentIntent existingIntent = requireStripe().v1().paymentIntents()
                        .retrieve(pending.getStripePaymentIntentId(), accountOptions(connectedAccountId));
                    return toStripeResponse(pending, existingIntent.getClientSecret());
                } catch (StripeException ex) {
                    LOG.warn("Could not retrieve existing PaymentIntent {} for invoice {}, creating a new one",
                        pending.getStripePaymentIntentId(), invoice.getInvoiceNumber(), ex);
                }
            } else {
                LOG.info("Superseding PaymentIntent {} on invoice {} (amount {}→{}, method {}→{})",
                    pending.getStripePaymentIntentId(), invoice.getInvoiceNumber(),
                    pending.getAmountCents(), outstanding, pending.getMethod(), req.method());
                // Minting the replacement is only safe once the old intent is
                // provably dead. If Stripe refuses to cancel it — because it
                // already succeeded, or simply because the call failed — the
                // client can still be holding its client secret in another tab,
                // and two confirmable intents against one invoice is a double
                // charge. Only the newest PENDING row is ever reconsidered, so
                // nothing would come back to clean it up either.
                if (!cancelSupersededIntent(pending)) {
                    throw new ConflictException(
                        "A payment for this invoice is still being processed. "
                            + "Please reload the page and try again in a moment.");
                }
            }
        }

        // Pulled out and asserted rather than dereferenced inline: Invoice
        // implements Persistable<UUID>, whose getId() is nullable for the
        // transient case. This one came out of a locked SELECT, so it has an id
        // — saying so once is clearer than SpotBugs pointing at the metadata
        // line and clearer than a defensive branch that can never run.
        UUID persistedInvoiceId =
            Objects.requireNonNull(invoice.getId(), "a persisted invoice has an id");

        long applicationFee = commission.feeCents(outstanding, tenant.getPlan());

        PaymentIntent intent;
        try {
            PaymentIntentCreateParams.Builder params = PaymentIntentCreateParams.builder()
                .setAmount(outstanding)
                .setCurrency(Normalize.lower(invoice.getCurrency()))
                .addPaymentMethodType(req.method() == PaymentMethod.CARD ? "card" : "sepa_debit")
                .setReceiptEmail(invoice.getBuyerEmail())
                .setDescription("Rechnung " + invoice.getInvoiceNumber())
                .putMetadata("tenant_id", tenantId.toString())
                .putMetadata("invoice_id", persistedInvoiceId.toString())
                .putMetadata("invoice_number", invoice.getInvoiceNumber());
            // Omitted entirely rather than sent as 0 on the plans that pay no
            // commission — Stripe treats a present application_fee_amount as
            // an assertion that the platform is taking a cut, and a zero-fee
            // one shows up as a €0.00 application fee on the photographer's
            // own dashboard for no reason.
            if (applicationFee > 0) {
                params.setApplicationFeeAmount(applicationFee);
            }
            intent = requireStripe().v1().paymentIntents()
                .create(params.build(), accountOptions(connectedAccountId));
        } catch (StripeException ex) {
            LOG.error("Stripe PaymentIntent creation failed for invoice {}", invoice.getInvoiceNumber(), ex);
            throw new UpstreamServiceException("stripe",
                "We couldn't start the card payment just now. Please try again, "
                    + "or pay this invoice by bank transfer.", ex);
        }

        Payment payment = new Payment(tenantId, invoice.getId(), req.method(), (int) outstanding,
            intent.getId(), connectedAccountId, (int) applicationFee);
        paymentRepository.save(payment);

        auditService.log("PAYMENT_INTENT_CREATED", "PAYMENT", payment.getId(), tenantId, actorId, ipAddress);

        return toStripeResponse(payment, intent.getClientSecret());
    }

    /**
     * The photographer confirming money has arrived by bank transfer.
     * Immediately SUCCEEDED — there's no async confirmation step for a
     * manual method, the photographer's word (backed by looking at their
     * bank statement) is the confirmation.
     */
    @Transactional
    public PaymentResponse recordManualPayment(UUID invoiceId, RecordManualPaymentRequest req, String ipAddress) {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        UUID actorId = SecurityUtils.requireCurrentUserId();
        Invoice invoice = lockInvoiceForPayment(invoiceId);
        requirePayable(invoice);

        long outstanding = outstandingCents(invoice);
        int amount = req.amountCents() != null ? req.amountCents() : (int) outstanding;
        if (amount <= 0) {
            throw new ConflictException("Payment amount must be positive");
        }
        // An explicit amount above the outstanding balance is a typo, not a
        // gift: accepting it books money the invoice never asked for, which
        // then has to be refunded outside the system and leaves the DATEV
        // export claiming more revenue than was invoiced.
        if (amount > outstanding) {
            throw new ConflictException(
                "Payment of " + amount + " cents exceeds the " + outstanding
                    + " cents outstanding on invoice " + invoice.getInvoiceNumber());
        }

        Payment payment = new Payment(tenantId, invoice.getId(), PaymentMethod.UEBERWEISUNG, amount, null);
        payment.setStatus(PaymentStatus.SUCCEEDED);
        payment.setConfirmedByUserId(actorId);
        payment.setConfirmedAt(OffsetDateTime.now(clock));
        paymentRepository.save(payment);

        auditService.log("PAYMENT_RECORDED_MANUAL", "PAYMENT", payment.getId(), tenantId, actorId, ipAddress);

        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public InvoicePaymentSummaryResponse getSummary(UUID invoiceId) {
        Invoice invoice = requireInvoice(invoiceId);
        requireOwnedByCallerIfCustomer(invoice);
        List<Payment> payments = paymentRepository.findByInvoiceIdOrderByCreatedAtDesc(invoiceId);
        long paid = paymentRepository.sumSucceededAmountCents(invoiceId);
        List<PaymentResponse> responses = payments.stream().map(this::toResponse).toList();
        return new InvoicePaymentSummaryResponse(
            invoice.getTotalCents(),
            (int) paid,
            (int) Math.max(0, invoice.getTotalCents() - paid),
            invoice.getVerwendungszweck(),
            responses
        );
    }

    /**
     * PHOTOGRAPHER/ADMIN callers may act on any invoice in their tenant
     * (already enforced by RLS); a CUSTOMER caller must own the invoice via
     * its booking. Mirrors {@code BookingService#getOwnBookings}: identity
     * is resolved from the JWT and matched on {@code client_email}, never
     * from a caller-supplied id, since {@code Client} carries no direct link
     * back to the auth {@code User}. A mismatch reports 404 rather than 403
     * so a customer probing invoice ids can't distinguish "not yours" from
     * "doesn't exist".
     */
    private void requireOwnedByCallerIfCustomer(Invoice invoice) {
        if (!SecurityUtils.currentUserHasRole("CUSTOMER")) {
            return;
        }
        var user = userRepository.findById(SecurityUtils.requireCurrentUserId())
            .orElseThrow(() -> new UnauthorizedException("Authentication required"));
        Booking booking = invoice.getBookingId() != null
            ? bookingRepository.findById(invoice.getBookingId()).orElse(null)
            : null;
        if (booking == null || !booking.getClientEmail().equalsIgnoreCase(user.getEmail())) {
            throw new NotFoundException("Invoice not found: " + invoice.getId());
        }
    }

    /**
     * A storniert invoice has been legally withdrawn — its Storno counterpart
     * already nets it to zero, so collecting against it books money that no
     * document claims. Neither payment path checked this, so a client sitting
     * on a payment link (or a photographer on a stale invoice screen) could
     * still pay an invoice that had been cancelled underneath them.
     */
    private void requirePayable(Invoice invoice) {
        if (invoice.getStatus() == InvoiceStatus.STORNIERT) {
            throw new ConflictException(
                "Invoice " + invoice.getInvoiceNumber() + " has been storniert and can no longer be paid");
        }
        if (invoice.getStornoOfId() != null) {
            throw new ConflictException(
                "Invoice " + invoice.getInvoiceNumber() + " is a Storno correction, not a payable invoice");
        }
    }

    /**
     * Cancels a superseded PaymentIntent, reporting whether it is now safe to
     * mint a replacement.
     *
     * <p>Returns false rather than throwing so the caller decides what a
     * failure means — but it must not treat it as harmless: a live intent the
     * client still holds the secret for can settle the same invoice a second
     * time.
     */
    private boolean cancelSupersededIntent(Payment pending) {
        try {
            requireStripe().v1().paymentIntents()
                .cancel(pending.getStripePaymentIntentId(), accountOptions(pending.getStripeAccountId()));
            pending.setStatus(PaymentStatus.CANCELED);
            // saveAndFlush, not save: `uq_payments_one_pending_per_invoice`
            // allows one PENDING row per invoice, and Hibernate's default flush
            // order writes INSERTs before UPDATEs. Left to the automatic flush,
            // the replacement row would be inserted while this one is still
            // PENDING in the database and the insert would fail on the index —
            // turning a routine supersede into an error. Pushing the status
            // change out first keeps the two writes in the order the constraint
            // describes.
            paymentRepository.saveAndFlush(pending);
            return true;
        } catch (StripeException ex) {
            LOG.warn("Could not cancel superseded PaymentIntent {}", pending.getStripePaymentIntentId(), ex);
            return false;
        }
    }

    /**
     * Scopes a Stripe call to a connected account. A direct-charge
     * PaymentIntent does not exist from the platform account's point of view,
     * so omitting this turns every retrieve/cancel into a 404 from Stripe.
     */
    private RequestOptions accountOptions(String connectedAccountId) {
        return RequestOptions.builder().setStripeAccount(connectedAccountId).build();
    }

    private long outstandingCents(Invoice invoice) {
        long paid = paymentRepository.sumSucceededAmountCents(invoice.getId());
        return Math.max(0, invoice.getTotalCents() - paid);
    }

    private Invoice requireInvoice(UUID invoiceId) {
        return invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new NotFoundException("Invoice not found: " + invoiceId));
    }

    /**
     * Loads the invoice with a row lock held for the rest of the transaction,
     * making every operation that collects money against one invoice mutually
     * exclusive.
     *
     * <p>Both callers below are check-then-act on the outstanding balance —
     * "no open intent, so mint one", "this amount fits, so book it" — and
     * neither conclusion survives a concurrent writer. Serialising them per
     * invoice is what makes those reads still true at the moment they are
     * acted on. See {@code InvoiceRepository#findByIdForPayment} for why the
     * lock is NOWAIT rather than blocking.
     */
    private Invoice lockInvoiceForPayment(UUID invoiceId) {
        try {
            return invoiceRepository.findByIdForPayment(invoiceId)
                .orElseThrow(() -> new NotFoundException("Invoice not found: " + invoiceId));
        } catch (PessimisticLockingFailureException ex) {
            // Someone else is mid-payment on this invoice. Not an error worth a
            // stack trace — the honest answer is that the caller should look
            // again in a second, by which time the other request has settled
            // and the balance they'd be paying may well have changed.
            LOG.info("Invoice {} is locked by another payment operation", invoiceId);
            throw new ConflictException(
                "A payment for this invoice is already being processed. "
                    + "Please reload the page and try again in a moment.");
        }
    }

    /**
     * The Stripe client, or a 409 explaining that this deployment runs without
     * one. Deliberately the same exception {@code
     * StripeConnectService#requireStripe} throws: it is the same condition seen
     * from two places, and answering 500 here and 409 there made the frontend's
     * handling of "Stripe isn't available" depend on which endpoint it happened
     * to call. Not a server fault either way — running on bank transfer alone
     * is a supported configuration.
     */
    private StripeClient requireStripe() {
        return stripeClient.orElseThrow(() -> new ConflictException(
            "Online payments are not available on this deployment — Stripe is not configured"));
    }

    /** History/summary shape — no client secret, so no Stripe.js credentials. */
    private PaymentResponse toResponse(Payment payment) {
        return buildResponse(payment, null, null, null);
    }

    /**
     * A payable intent. Carries the publishable key and the connected account
     * together, because Stripe.js needs both to resolve this client secret:
     * initialised against the platform account alone it cannot see a direct
     * charge that lives on the photographer's.
     */
    private PaymentResponse toStripeResponse(Payment payment, String clientSecret) {
        return buildResponse(payment, clientSecret, publishableKey, payment.getStripeAccountId());
    }

    private PaymentResponse buildResponse(
        Payment payment, String clientSecret, String pubKey, String connectedAccountId) {
        return new PaymentResponse(
            payment.getId(),
            payment.getInvoiceId(),
            payment.getMethod().name(),
            payment.getStatus().name(),
            payment.getAmountCents(),
            payment.getCurrency(),
            clientSecret,
            pubKey,
            connectedAccountId,
            payment.getApplicationFeeCents(),
            payment.getCreatedAt(),
            payment.getConfirmedAt()
        );
    }
}
