package com.photographplatform.api.payment.service;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.booking.domain.Booking;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.invoice.domain.Invoice;
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
import com.photographplatform.api.payment.repository.ProcessedStripeEventRepository;
import com.stripe.StripeClient;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.net.Webhook;
import com.stripe.param.PaymentIntentCreateParams;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Payments against an issued {@link Invoice} — Stripe Card/SEPA Payment
 * Intents, and the manual Überweisung path (still the most common method at
 * this price point in Germany, per the spec's own market read).
 */
@Service
public class PaymentService {

    private static final Logger LOG = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepository;
    private final ProcessedStripeEventRepository processedEventRepository;
    private final InvoiceRepository invoiceRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final Optional<StripeClient> stripeClient;
    private final String webhookSecret;
    private final AuditService auditService;
    private final TransactionTemplate freshTransaction;

    public PaymentService(
        PaymentRepository paymentRepository,
        ProcessedStripeEventRepository processedEventRepository,
        InvoiceRepository invoiceRepository,
        BookingRepository bookingRepository,
        UserRepository userRepository,
        Optional<StripeClient> stripeClient,
        PaymentProperties paymentProperties,
        AuditService auditService,
        PlatformTransactionManager transactionManager
    ) {
        this.paymentRepository = paymentRepository;
        this.processedEventRepository = processedEventRepository;
        this.invoiceRepository = invoiceRepository;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.stripeClient = stripeClient;
        this.webhookSecret = paymentProperties.getWebhookSecret();
        this.auditService = auditService;
        this.freshTransaction = new TransactionTemplate(transactionManager);
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
        Invoice invoice = requireInvoice(invoiceId);
        requireOwnedByCallerIfCustomer(invoice);

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
        Optional<Payment> existingPending = paymentRepository
            .findFirstByInvoiceIdAndStatusAndStripePaymentIntentIdIsNotNullOrderByCreatedAtDesc(
                invoice.getId(), PaymentStatus.PENDING.name());
        if (existingPending.isPresent()) {
            Payment pending = existingPending.get();
            try {
                PaymentIntent existingIntent = requireStripe().v1().paymentIntents()
                    .retrieve(pending.getStripePaymentIntentId());
                return toResponse(pending, existingIntent.getClientSecret());
            } catch (StripeException ex) {
                LOG.warn("Could not retrieve existing PaymentIntent {} for invoice {}, creating a new one",
                    pending.getStripePaymentIntentId(), invoice.getInvoiceNumber(), ex);
            }
        }

        PaymentIntent intent;
        try {
            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setAmount(outstanding)
                .setCurrency(invoice.getCurrency().toLowerCase(java.util.Locale.ROOT))
                .addPaymentMethodType(req.method() == PaymentMethod.CARD ? "card" : "sepa_debit")
                .setReceiptEmail(invoice.getBuyerEmail())
                .putMetadata("tenant_id", tenantId.toString())
                .putMetadata("invoice_id", invoice.getId().toString())
                .putMetadata("invoice_number", invoice.getInvoiceNumber())
                .build();
            intent = requireStripe().v1().paymentIntents().create(params);
        } catch (StripeException ex) {
            LOG.error("Stripe PaymentIntent creation failed for invoice {}", invoice.getInvoiceNumber(), ex);
            throw new IllegalStateException("Could not start payment: " + ex.getMessage(), ex);
        }

        Payment payment = new Payment(tenantId, invoice.getId(), req.method(), (int) outstanding, intent.getId());
        paymentRepository.save(payment);

        auditService.log("PAYMENT_INTENT_CREATED", "PAYMENT", payment.getId(), tenantId, actorId, ipAddress);

        return toResponse(payment, intent.getClientSecret());
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
        Invoice invoice = requireInvoice(invoiceId);

        long outstanding = outstandingCents(invoice);
        int amount = req.amountCents() != null ? req.amountCents() : (int) outstanding;
        if (amount <= 0) {
            throw new ConflictException("Payment amount must be positive");
        }

        Payment payment = new Payment(tenantId, invoice.getId(), PaymentMethod.UEBERWEISUNG, amount, null);
        payment.setStatus(PaymentStatus.SUCCEEDED);
        payment.setConfirmedByUserId(actorId);
        payment.setConfirmedAt(OffsetDateTime.now());
        paymentRepository.save(payment);

        auditService.log("PAYMENT_RECORDED_MANUAL", "PAYMENT", payment.getId(), tenantId, actorId, ipAddress);

        return toResponse(payment, null);
    }

    /**
     * Verifies the Stripe signature, then applies the event idempotently.
     * Unauthenticated by design (Stripe calls this directly) — the tenant is
     * recovered from the PaymentIntent's own metadata, not from a JWT, and
     * bound to {@link TenantContext} only for the duration of the DB work
     * below so the payment row update is RLS-scoped correctly.
     *
     * <p>Deliberately NOT {@code @Transactional} at the method level, and the
     * DB work runs inside a freshly-started {@link TransactionTemplate}
     * rather than an ambient ({@code @Transactional}-proxy-opened) one: a
     * transaction's JDBC connection — and with it, the {@code app.tenant_id}
     * GUC {@link com.photographplatform.api.common.config.TenantRoutingDataSource}
     * binds when that connection is first acquired — is fixed for the whole
     * transaction. If this method's own {@code @Transactional} proxy had
     * already opened (and so already acquired a connection for) the
     * transaction before {@link TenantContext} is set below, setting it
     * afterwards would silently do nothing and the payment lookup would see
     * zero rows (RLS fails closed) even though the row exists — starting a
     * genuinely new transaction here, after the tenant is known, is what
     * guarantees the connection is acquired (and the GUC bound) at the right
     * moment. Signature verification and event/intent deserialization happen
     * first and need no DB access at all.
     */
    public void handleWebhookEvent(String payload, String signatureHeader) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new IllegalStateException("Stripe webhook secret not configured");
        }
        Event event;
        try {
            event = Webhook.constructEvent(payload, signatureHeader, webhookSecret);
        } catch (SignatureVerificationException ex) {
            throw new ConflictException("Invalid Stripe webhook signature");
        }

        PaymentIntent intent = deserializePaymentIntent(event);
        String tenantIdStr = (intent != null && intent.getMetadata() != null)
            ? intent.getMetadata().get("tenant_id")
            : null;

        if (tenantIdStr != null) {
            TenantContext.setTenant(tenantIdStr);
        }
        try {
            freshTransaction.executeWithoutResult(status -> applyWebhookEvent(event, intent, tenantIdStr));
        } finally {
            TenantContext.clear();
        }
    }

    private void applyWebhookEvent(Event event, PaymentIntent intent, String tenantIdStr) {
        boolean claimed = processedEventRepository.tryClaim(event.getId()) > 0;
        if (!claimed) {
            LOG.info("Ignoring already-processed Stripe event {}", event.getId());
            return;
        }

        if (intent != null && isPaymentIntentEvent(event.getType())) {
            applyPaymentIntentUpdate(event.getType(), intent, tenantIdStr);
        }
    }

    /**
     * {@code getObject()} only succeeds when the event's {@code api_version}
     * matches the SDK's compiled version exactly — Stripe's documented
     * fallback is {@code deserializeUnsafe()}, which parses the raw JSON
     * regardless of version skew. Without this fallback, a Stripe account
     * pinned to a slightly different API version than this SDK build would
     * silently produce a {@code null} intent here and every webhook would be
     * marked processed without ever updating the payment row.
     */
    private PaymentIntent deserializePaymentIntent(Event event) {
        Optional<com.stripe.model.StripeObject> deserialized = event.getDataObjectDeserializer().getObject();
        com.stripe.model.StripeObject object;
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
        return object instanceof PaymentIntent intent ? intent : null;
    }

    /**
     * Caller ({@link #handleWebhookEvent}) has already bound {@link
     * TenantContext} to {@code tenantIdStr} before its own first DB call —
     * this method must not re-set it, since by this point the transaction's
     * connection (and its {@code app.tenant_id} GUC) is already fixed for
     * the rest of the transaction regardless.
     */
    private void applyPaymentIntentUpdate(String eventType, PaymentIntent intent, String tenantIdStr) {
        if (tenantIdStr == null) {
            LOG.warn("PaymentIntent {} has no tenant_id metadata — skipping", intent.getId());
            return;
        }
        Optional<Payment> maybePayment = paymentRepository.findByStripePaymentIntentId(intent.getId());
        if (maybePayment.isEmpty()) {
            LOG.warn("No payment row for PaymentIntent {}", intent.getId());
            return;
        }
        Payment payment = maybePayment.get();
        switch (eventType) {
            case "payment_intent.succeeded" -> {
                payment.setStatus(PaymentStatus.SUCCEEDED);
                payment.setConfirmedAt(OffsetDateTime.now());
            }
            case "payment_intent.payment_failed" -> payment.setStatus(PaymentStatus.FAILED);
            case "payment_intent.canceled" -> payment.setStatus(PaymentStatus.CANCELED);
            default -> {
                return;
            }
        }
        paymentRepository.save(payment);
        auditService.log("PAYMENT_" + payment.getStatus(), "PAYMENT", payment.getId(),
            UUID.fromString(tenantIdStr), payment.getConfirmedByUserId(), "stripe-webhook");
    }

    private boolean isPaymentIntentEvent(String type) {
        return type.startsWith("payment_intent.");
    }

    @Transactional(readOnly = true)
    public InvoicePaymentSummaryResponse getSummary(UUID invoiceId) {
        Invoice invoice = requireInvoice(invoiceId);
        requireOwnedByCallerIfCustomer(invoice);
        List<Payment> payments = paymentRepository.findByInvoiceIdOrderByCreatedAtDesc(invoiceId);
        long paid = paymentRepository.sumSucceededAmountCents(invoiceId);
        List<PaymentResponse> responses = payments.stream().map(p -> toResponse(p, null)).toList();
        return new InvoicePaymentSummaryResponse(
            invoice.getTotalCents(),
            (int) paid,
            (int) Math.max(0, invoice.getTotalCents() - paid),
            "RE-" + invoice.getInvoiceNumber(),
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

    private long outstandingCents(Invoice invoice) {
        long paid = paymentRepository.sumSucceededAmountCents(invoice.getId());
        return Math.max(0, invoice.getTotalCents() - paid);
    }

    private Invoice requireInvoice(UUID invoiceId) {
        return invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new NotFoundException("Invoice not found: " + invoiceId));
    }

    private StripeClient requireStripe() {
        return stripeClient.orElseThrow(() -> new IllegalStateException("Stripe is not configured"));
    }

    private PaymentResponse toResponse(Payment payment, String clientSecret) {
        return new PaymentResponse(
            payment.getId(),
            payment.getInvoiceId(),
            payment.getMethod().name(),
            payment.getStatus().name(),
            payment.getAmountCents(),
            payment.getCurrency(),
            clientSecret,
            payment.getCreatedAt(),
            payment.getConfirmedAt()
        );
    }
}
